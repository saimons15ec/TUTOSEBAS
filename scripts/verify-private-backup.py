#!/usr/bin/env python3
"""Validate a private TUTOSEBAS ZIP and optionally restore into a NEW folder.

No remote database or bucket is modified. Never put the backup/output in GitHub.
"""
import argparse
import hashlib
import json
import re
import sqlite3
import sys
import zipfile
from pathlib import Path

TABLES = {"profiles": "profiles", "records": "records", "file_objects": "fileObjects", "security_audit": "securityAudit", "auth_identities": "authIdentities"}
MAX_FILE = 25 * 1024 * 1024

def validate(path):
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)) or len(names) > 5002:
            raise ValueError("El ZIP tiene entradas duplicadas o excede el límite.")
        if any(i.file_size > MAX_FILE for i in archive.infolist()) or sum(i.file_size for i in archive.infolist()) > 500 * 1024 * 1024:
            raise ValueError("El ZIP supera el límite de verificación.")
        if archive.testzip() is not None:
            raise ValueError("El ZIP no supera la comprobación CRC.")
        data = json.loads(archive.read("backup.json"))
        manifest = json.loads(archive.read("manifest.json"))
        if data.get("format") != "tutosebas-logical-backup" or data.get("schemaVersion") != 3 or manifest.get("format") != "tutosebas-private-backup" or manifest.get("schemaVersion") != 1:
            raise ValueError("Formato de respaldo no compatible.")
        if any(k in data for k in ["authSessions", "passwords", "secrets"]):
            raise ValueError("El respaldo incluye datos de sesión no permitidos.")
        entries = manifest.get("objects", [])
        if len(entries) != data["counts"]["r2Objects"] or len({e["key"] for e in entries}) != len(entries):
            raise ValueError("El manifiesto de archivos no está completo.")
        expected = {"backup.json", "manifest.json"}
        for entry in entries:
            if not re.fullmatch(r"objects/[0-9]{6}-[a-f0-9]{16}\.bin", entry["path"]):
                raise ValueError("Ruta de archivo no válida.")
            expected.add(entry["path"])
            content = archive.read(entry["path"])
            if len(content) != entry["size"] or hashlib.sha256(content).hexdigest() != entry["sha256"]:
                raise ValueError("El contenido de un archivo no coincide con su manifiesto.")
        if set(names) != expected:
            raise ValueError("El ZIP contiene entradas inesperadas o incompletas.")
        by_key = {e["key"]: e for e in entries}
        for row in data["fileObjects"]:
            item = by_key.get(row["object_key"])
            if row["status"] == "active" and not item:
                raise ValueError("Falta un archivo activo.")
            if item and (row["sha256"] != item["sha256"] or row["size_bytes"] != item["size"]):
                raise ValueError("El registro de un archivo no coincide con su copia.")
        for table, field in TABLES.items():
            if not isinstance(data[field], list):
                raise ValueError("Una tabla del respaldo no es válida.")
            count_key = {"securityAudit": "auditEvents"}.get(field, field)
            if len(data[field]) != data["counts"][count_key]:
                raise ValueError("La cantidad de registros no coincide.")
        return data, manifest

def restore(path, output, data, manifest):
    output.mkdir(parents=True, exist_ok=False)
    root = Path(__file__).resolve().parent.parent
    database = sqlite3.connect(output / "tutosebas.sqlite3")
    try:
        database.execute("PRAGMA foreign_keys=ON")
        journal = json.loads((root / "drizzle/meta/_journal.json").read_text())
        for entry in journal["entries"]:
            database.executescript((root / f'drizzle/{entry["tag"]}.sql').read_text())
        sql_lines = ["-- PRIVATE: import only into a NEW database with these migrations already applied."]
        for table, field in TABLES.items():
            allowed = {r[1] for r in database.execute(f'PRAGMA table_info("{table}")')}
            for row in data[field]:
                if not row or not set(row).issubset(allowed):
                    raise ValueError("Columnas no compatibles con el esquema.")
                columns = list(row)
                values = [row[k] for k in columns]
                names = ",".join(f'"{k}"' for k in columns)
                database.execute(f'INSERT INTO "{table}"({names}) VALUES({",".join("?" for _ in values)})', values)
                quoted = ",".join(database.execute("SELECT quote(?)", (v,)).fetchone()[0] for v in values)
                sql_lines.append(f'INSERT INTO "{table}"({names}) VALUES({quoted});')
        if database.execute("PRAGMA foreign_key_check").fetchall():
            raise ValueError("Las referencias entre cuentas no son válidas.")
        database.commit()
        with zipfile.ZipFile(path) as archive:
            for entry in manifest["objects"]:
                target = output / entry["path"]
                target.parent.mkdir(exist_ok=True)
                target.write_bytes(archive.read(entry["path"]))
        (output / "manifest.json").write_text(json.dumps(manifest, indent=2))
        (output / "data-import.sql").write_text("\n".join(sql_lines) + "\n")
    finally:
        database.close()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--restore-to", type=Path, help="A new, non-existing folder; never a live database")
    args = parser.parse_args()
    try:
        data, manifest = validate(args.archive)
        if args.restore_to:
            restore(args.archive, args.restore_to, data, manifest)
        print(json.dumps({"verified": True, "restored": bool(args.restore_to), "counts": data["counts"], "bytes": sum(e["size"] for e in manifest["objects"])}))
    except (ValueError, KeyError, TypeError, OSError, sqlite3.Error, zipfile.BadZipFile):
        print("No se pudo verificar/restaurar el respaldo. Revisa el formato, la integridad y que el destino sea nuevo.", file=sys.stderr)
        return 1
    return 0

if __name__ == "__main__":
    sys.exit(main())
