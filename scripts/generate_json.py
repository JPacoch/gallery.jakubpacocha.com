import cloudinary
import cloudinary.api
import json
import math
import os
import shutil
from datetime import datetime

from dotenv import load_dotenv

load_dotenv()

cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", "your_cloud_name")
api_key = os.getenv("CLOUDINARY_API_KEY", "your_key")
api_secret = os.getenv("CLOUDINARY_API_SECRET", "your_secret")

DATA_JSON = os.path.join(os.path.dirname(__file__), '..', 'data', 'photos.json')
BACKUP_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'backups')

if not all([cloud_name, api_key, api_secret]):
    print("Error: Cloudinary credentials missing from .env file!")
else:
    cloudinary.config(
        cloud_name=cloud_name,
        api_key=api_key,
        api_secret=api_secret,
        secure=True
    )


def get_gcd(a, b):
    return math.gcd(a, b)


def create_backup(filepath):
    if not os.path.exists(filepath):
        return
    if not os.path.exists(BACKUP_DIR):
        os.makedirs(BACKUP_DIR)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = os.path.basename(filepath)
    backup_path = os.path.join(BACKUP_DIR, f"{filename}.{timestamp}.bak")
    shutil.copy2(filepath, backup_path)
    print(f"Backup created at: {backup_path}")


def load_existing(filepath):
    try:
        with open(filepath, 'r') as f:
            data = json.load(f)
        return {p['publicId']: p for p in data.get('photos', [])}
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError:
        print(f"Warning: could not parse {filepath}; starting fresh.")
        return {}


def build_new_entry(res, folder_path):
    meta = res.get('image_metadata', {})
    w, h = res.get('width', 0), res.get('height', 0)

    if w > 0 and h > 0:
        common = get_gcd(w, h)
        simple_ratio = f"{w // common}:{h // common}"
    else:
        simple_ratio = "Unknown"

    if folder_path:
        category_name = str(folder_path).split('/')[-1].replace('-', ' ').replace('_', ' ').title()
    else:
        category_name = "General"

    raw_filename = res.get('filename')
    clean_title = str(raw_filename).replace('-', ' ').replace('_', ' ').title() if raw_filename else "Untitled"

    return {
        "id": "",         
        "publicId": res.get('public_id', ''),
        "title": clean_title,
        "category": category_name,
        "year": (res.get('created_at') or "2026")[:4],
        "_created_at": res.get('created_at'),   # temp field for sorting
        "aspectRatio": simple_ratio,
        "orientation": "landscape" if w > h else "portrait",
        "exif": {
            "camera": meta.get('Model', 'Unknown'),
            "lens": meta.get('LensModel', 'Unknown'),
            "aperture": f"f/{meta.get('FNumber')}" if meta.get('FNumber') else "N/A",
            "shutter": f"{meta.get('ExposureTime')}s" if meta.get('ExposureTime') else "N/A",
            "iso": str(meta.get('ISO', 'N/A')),
        }
    }


def fetch_cloudinary_resources():
    results = []
    root_folder = ""

    try:
        if root_folder:
            print(f"Scanning subfolders of: {root_folder}...")
            folder_resp = cloudinary.api.subfolders(root_folder, max_results=500)
        else:
            print("Scanning all root folders...")
            folder_resp = cloudinary.api.root_folders(max_results=500)

        folder_paths = [f['path'] for f in folder_resp.get('folders', [])]
        folder_paths.append(root_folder)

        for folder_path in folder_paths:
            display_name = folder_path if folder_path else "Root"
            print(f"Fetching images from: {display_name}...")

            resources = cloudinary.api.resources(
                type="upload",
                prefix=folder_path,
                image_metadata=True,
                max_results=500
            )

            for res in resources.get('resources', []):
                pid = res.get('public_id', '')
                current_file_path = pid.rsplit('/', 1)[0] if '/' in pid else ""
                if current_file_path != folder_path:
                    continue
                results.append((res, folder_path))

    except Exception as e:
        print(f"An error occurred fetching from Cloudinary: {e}")
        raise

    return results


def sync_photos():
    print("Fetching assets from Cloudinary...")
    try:
        cloudinary_assets = fetch_cloudinary_resources()
    except Exception:
        return

    cloudinary_map = {res.get('public_id', ''): (res, fp) for res, fp in cloudinary_assets}
    cloudinary_ids = set(cloudinary_map.keys())

    existing = load_existing(DATA_JSON)
    existing_ids = set(existing.keys())

    #create backup before writing
    create_backup(DATA_JSON)

    merged = []

    removed = 0
    for pid, entry in existing.items():
        if pid in cloudinary_ids:
            merged.append(entry)
        else:
            print(f"  Removing deleted photo: {pid}")
            removed += 1

    added = 0
    new_entries = []
    for pid, (res, folder_path) in cloudinary_map.items():
        if pid not in existing_ids:
            entry = build_new_entry(res, folder_path)
            new_entries.append(entry)
            print(f"  Adding new photo: {pid}")
            added += 1

    new_entries.sort(key=lambda x: x.get('_created_at') or "")

    merged.extend(new_entries)

    for i, entry in enumerate(merged, 1):
        entry['id'] = str(i)
        entry.pop('_created_at', None)   #remove temp sort field if present

    # Write output
    data_dir = os.path.dirname(DATA_JSON)
    if data_dir and not os.path.exists(data_dir):
        os.makedirs(data_dir)

    with open(DATA_JSON, 'w') as f:
        json.dump({"photos": merged}, f, indent=2)

    print("-" * 40)
    print("Sync complete!")
    print(f"  Total photos : {len(merged)}")
    print(f"  Added        : {added}")
    print(f"  Removed      : {removed}")
    print(f"  Preserved    : {len(merged) - added}")
    print(f"Output written to: {os.path.abspath(DATA_JSON)}")


if __name__ == "__main__":
    sync_photos()