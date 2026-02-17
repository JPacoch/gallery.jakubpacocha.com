import json
import os
import shutil
from datetime import datetime

# conf
ROOT_JSON = "photos.json"
DATA_JSON = "data/photos.json"
BACKUP_DIR = "data/backups"

def load_json(filepath):
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return None
    except json.JSONDecodeError:
        print(f"Error decoding {filepath}")
        return None

def save_json(filepath, data):
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)

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

def sync_photos():
    print("Starting photo synchronization...")
    
    root_data = load_json(ROOT_JSON)
    if not root_data:
        print(f"Error: {ROOT_JSON} not found or invalid.")
        return

    current_data = load_json(DATA_JSON)
    if not current_data:
        print(f"Warning: {DATA_JSON} not found. Creating new from root.")
        save_json(DATA_JSON, root_data)
        return

    create_backup(DATA_JSON)

    new_photos_list = root_data.get('photos', [])
    current_photos_list = current_data.get('photos', [])

    new_public_ids = {p['publicId'] for p in new_photos_list}
    current_public_ids = {p['publicId'] for p in current_photos_list}

    synced_list = []
    
    print(f"Processing existing {len(current_photos_list)} photos...")
    for photo in current_photos_list:
        if photo['publicId'] in new_public_ids:
            synced_list.append(photo)
        else:
            print(f"Removing deleted photo: {photo.get('publicId')}")

    print(f"Checking {len(new_photos_list)} source photos for additions...")
    added_count = 0
    for photo in new_photos_list:
        if photo['publicId'] not in current_public_ids:
            synced_list.append(photo)
            print(f"Adding new photo: {photo.get('publicId')}")
            added_count += 1

    result_data = {'photos': synced_list}
    save_json(DATA_JSON, result_data)
    
    print("-" * 30)
    print("Sync complete!")
    print(f"Total photos: {len(synced_list)}")
    print(f"Added: {added_count}")
    print(f"Removed: {len(current_photos_list) - (len(synced_list) - added_count)}")

if __name__ == "__main__":
    sync_photos()
