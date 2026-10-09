import os
import requests
import json
from datetime import datetime, timedelta, UTC
from yt_dlp import YoutubeDL
import subprocess
import time
import signal
import sys
import internetarchive as ia
import random
import shutil
import glob

# Youtube API parameters
API_PREFIX = "https://www.googleapis.com/youtube/v3/"
API_KEY = os.environ["API_KEY"]
CHANNEL_ID = "UC6yzBy1Cof8rKcPQtx1XxKQ"

# Internet Archive keys and configs
IA_ACCESS_KEY = os.environ["IA_ACCESS_KEY"]
IA_SECRET_KEY = os.environ["IA_SECRET_KEY"]
ia_headers = {
    "x-archive-queue-derive": "0",
}
ia_metadata = {
    "mediatype": "movies",
    "title": title,
}

# Books of the Bible to detect for playlists
bible_books = (
    # Old Testament
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
    "Joshua", "Judges", "Ruth",
    "1 Samuel", "2 Samuel",
    "1 Kings", "2 Kings",
    "1 Chronicles", "2 Chronicles",
    "Ezra", "Nehemiah", "Esther",
    "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon",
    "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel",
    "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah",
    "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",

    # New Testament
    "Matthew", "Mark", "Luke", "John",
    "Acts",
    "Romans",
    "1 Corinthians", "2 Corinthians",
    "Galatians", "Ephesians", "Philippians", "Colossians",
    "1 Thessalonians", "2 Thessalonians",
    "1 Timothy", "2 Timothy",
    "Titus", "Philemon",
    "Hebrews",
    "James",
    "1 Peter", "2 Peter",
    "1 John", "2 John", "3 John",
    "Jude",
    "Revelation"
)

# Read metadata files
script_path = os.path.dirname(__file__)
transcripts_path = os.path.join(script_path, "transcripts.json")
id_map_path = os.path.join(script_path, "id_map.json")

with open(transcripts_path, "r") as json_file:
    transcripts = json.load(json_file)

with open(id_map_path, "r") as json_file:
    id_map = json.load(json_file)

# Videos to avoid processing, banned or already processed
BANNED_IDS = {"eqA-3qW-i8k", "KQvhm6KpBOg", "5W5xiaEhK9M"}
existing_video_ids = set()
def collect_ids(data):
    if isinstance(data, dict):
        for k, v in data.items():
            if k == "id" and isinstance(v, str):
                existing_video_ids.add(v)
            else:
                collect_ids(v)
    elif isinstance(data, list):
        for item in data:
            collect_ids(item)

collect_ids(transcripts)

# Handle signal interrupts
def handle_exit(sig, frame):
    print("\nInterrupt received. Saving progress...")
    with open(transcripts_path, "w") as f:
        json.dump(transcripts, f, separators=(",", ":"))
    sys.exit(0)

signal.signal(signal.SIGINT, handle_exit)
signal.signal(signal.SIGTERM, handle_exit)

# Utility functions
def clean_workdir():
    for f in glob.glob("input.*"):
        os.remove(f)

def iterate_api(url, params):
    results = []
    next_page = None
    while True:
        if next_page:
            params["pageToken"] = next_page

        r = requests.get(url, params=params)
        r.raise_for_status()
        data = r.json()

        results.extend(data.get("items", []))
        next_page = data.get("nextPageToken")

        if not next_page:
            break

    return results

def last_sunday():
    today = datetime.now(UTC).date()
    days_since_sunday = (today.weekday() + 1) % 7
    sunday = today - timedelta(days=days_since_sunday)
    return sunday.strftime("%Y-%m-%d")

def contains_video_with_date(data, target_date):
    if isinstance(data, dict):
        if "date" in data:
            if data["date"] == target_date:
                return True

        for key, value in data.items():
            if contains_video_with_date(value, target_date) and key != "live":
                return True

    elif isinstance(data, list):
        for item in data:
            if contains_video_with_date(item, target_date):
                return True

    return False

# Main video handling functions
def download_video(id, is_livestream=False, extract_audio=True):
    # Ensure there are no leftover input.* files that could interfere with incoming yt-dlp download
    clean_workdir()
    
    ydl_opts = {
        "cookiefile": "cookies.txt",
        "outtmpl": os.path.join(os.getcwd(), "input.%(ext)s"),
        "remote_components": ["ejs:github"],
        "postprocessor_args": {"extractaudio": ["-ar", "16000", "-ac", "1"]},
    }
    wav_pp = {"key": "FFmpegExtractAudio", "preferredcodec": "wav"}
    if is_livestream:
        # Audio-only for livestreams, pure transcription, no hosting, quicker
        ydl_opts.update({
            "format": (
                "bestaudio[acodec!=none][language=en]/"
                "bestaudio[acodec!=none][language=original]/"
                "bestaudio[acodec!=none]/best"
            ),
            "postprocessors": [wav_pp],
        })
    else:
        # Video included for clipped sermons, able to be hosted
        ydl_opts.update({
            "format": "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]",
            "merge_output_format": "mp4",
            "keepvideo": True,
            "postprocessors": [wav_pp] if extract_audio else [],
        })

    print("Downloading video...")
    with YoutubeDL(ydl_opts) as ydl:
        ydl.download([f"https://www.youtube.com/watch?v={id}"])
    print("Successfully downloaded video")

def upload_video(id, title):
    retries = 4
    delay = 15

    # Internet Archive compliant id format
    ia_id = f"fbc_{id}"
    
    for attempt in range(retries):
        try:
            print("Uploading video to the Internet Archive...")
            ia.upload(
                ia_id,
                files=["input.mp4"],
                access_key=IA_ACCESS_KEY,
                secret_key=IA_SECRET_KEY,
                metadata=ia_metadata,
                headers=ia_headers,
                fast_fail=True,
                retries=15,
                verbose=True
            )
            
            id_map[id] = True
            with open(id_map_path, "w") as f:
                json.dump(id_map, f, separators=(",", ":"))

            return True
        except requests.exceptions.HTTPError as e:
            if "503" in str(e) or "Slow Down" in str(e):
                if attempt < retries - 1:
                    print(f"Rate limited (503). Retrying in {delay} seconds (Attempt {attempt + 1}/{retries})...")
                    time.sleep(delay)
                    delay *= 2 
                    continue
            raise e
    raise Exception(f"Failed to upload {id} after {retries} retries due to rate limiting.")

url = API_PREFIX + "playlists"
params = {
    "part": "snippet",
    "channelId": CHANNEL_ID,
    "maxResults": 1000,
    "key": API_KEY
}
playlists = iterate_api(url, params)

# Sort "Pastor Rob McNutt" to the end of the playlists array.
index = next((i for i, d in enumerate(playlists) if d["snippet"]["title"].lower() == "pastor rob mcnutt"), None)
playlists.append(playlists.pop(index))

playlists.append({
    "snippet": {
        "title": "live"
    }
})

all_videos = []

print("Found " + str(len(playlists)) + " playlists.")
for pl in playlists:
    title = pl["snippet"]["title"]
    is_livestream = title == "live"
    data_container = None

    isGuestSpeakers = title.lower() == "guest speakers"

    matched_book = next((b for b in bible_books if title.endswith(b)), None)
    if matched_book:
        data_container = transcripts["books"].setdefault(matched_book, [])
    elif title.lower() == "specials":
        data_container = transcripts["specials"]
    elif "mark lehew" in title.lower():
        data_container = transcripts["guests"]["mark_lehew"]
    elif isGuestSpeakers:
        data_container = transcripts["guests"]
    elif title.lower() == "pastor rob mcnutt":
        data_container = sum(transcripts["books"].values(), transcripts["other"])
    elif is_livestream:
        data_container = [transcripts.setdefault("live", {})]
    else:
        continue

    videos = []
    if is_livestream:
        url = API_PREFIX + "search"
        params = {
            "order": "date",
            "part": "snippet",
            "channelId": CHANNEL_ID,
            "maxResults": 1000,
            "key": API_KEY
        }

        next_page = None
        while True:
            if next_page:
                params["pageToken"] = next_page

            r = requests.get(url, params=params)
            r.raise_for_status()
            data = r.json()

            for video in data["items"]:
                video_data = video["snippet"]
                video_title = video_data["title"]
                if (
                    "live!" in video_title.lower() and
                    last_sunday() in video_title and
                    not contains_video_with_date(transcripts, last_sunday())
                ):
                    video_data["publishedAt"] = video_data["publishTime"]
                    video_data["resourceId"] = {
                        "videoId": video["id"]["videoId"]
                    }
                    videos = [video]
                    break

            next_page = data.get("nextPageToken")
            if not next_page:
                break
    else:
        url = API_PREFIX + "playlistItems"
        params = {
            "part": "snippet",
            "playlistId": pl["id"],
            "maxResults": 1000,
            "key": API_KEY
        }
        videos = iterate_api(url, params)
        all_videos.extend(videos)

    print("\n" + str(len(videos)) + " videos found in '" + title + "'.")
    for i, video in enumerate(videos):
        print("\nProcessing video " + str(i + 1) + "/" + str(len(videos)) + ".")
        start_time = time.time()

        video = video["snippet"]
        video_id = video["resourceId"]["videoId"]
        video_title = video["title"]

        if (
          not video_id or # No video id
          video_id in BANNED_IDS or # Video is banned from the Sermon Search
          video_id in existing_video_ids or # Video has already been processed
          video_title == "Private video" # Video is private, i.e., the video was removed
        ):
            continue

        timestamp = video_title.split(" ")[0]
        video_data = {
            "name": video_title,
            "id": video_id,
            "date": timestamp
        }
        video_container = data_container

        if isGuestSpeakers:
            if "greg ryan" in video_title.lower():
                video_container = video_container["greg_ryan"]
            else:
                video_container = video_container["other"]

        if title.lower() == "pastor rob mcnutt":
            video_container = transcripts["other"]

        download_video(video_id, is_livestream)

        # If not livestream, upload to hosting service
        if not is_livestream:
            upload_video(video_id, video_title)
            os.remove("input.mp4")

        # Transcribe audio track
        whisper_path = shutil.which("whisper-cli")
        thread_count = os.cpu_count() or 2
        whisper_args = [
            "-m", os.environ["WHISPER_MODEL"],
            "-f", "input.wav",
            "-t", str(thread_count),
            "--output-json",
            "-of", "output"
        ]
        print("Transcribing video...")
        subprocess.run([whisper_path] + whisper_args)
        print("Successfully transcribed video")

        with open("output.json", "r") as json_file:
            video_transcript = json.load(json_file)

        os.remove("input.wav")

        video_transcript = video_transcript["transcription"]
        for i, snippet in enumerate(video_transcript):
            timestamp = snippet["timestamps"]["from"].split(",")[0]
            h, m, s = timestamp.split(":")
            timestamp = f"{h + ':' if h != '00' else ''}{m}:{s}"
    
            text = snippet["text"]
            text = text[1:]
            if i != len(video_transcript) - 1:
                next_line = video_transcript[i + 1]["text"]
                if not next_line.startswith(" "):
                    split_line = next_line.split(" ", 1)
                    text += split_line[0]
                    if " " not in next_line.strip():
                        del video_transcript[i + 1]
                    else:
                        next_line = " " + split_line[1]
                    video_transcript[i + 1]["text"] = next_line
                text += " "

            video_transcript[i] = [ timestamp, text ]

        video_data["transcript"] = video_transcript
        os.remove("output.json")

        if is_livestream:
            transcripts["live"] = video_data
        else:
            video_container.append(video_data)

        # Add newly processed video to set of processed videos
        existing_video_ids.add(video_id)

        end_time = time.time()
        elapsed = int(end_time - start_time)
        minutes = elapsed // 60
        seconds = elapsed % 60
        print(f"\nCompleted video in {minutes:02d}:{seconds:02d}")

# Update transcripts file for end of script
with open(transcripts_path, "w") as f:
    json.dump(transcripts, f, separators=(",", ":"))

# Randomly upload sermon to host service
seen = set(id_map)
unhosted_videos = []
for video in all_videos:
    v_id = video["snippet"]["resourceId"]["videoId"]
    if v_id not in seen:
        seen.add(v_id)
        unhosted_videos.append(video)

if os.environ["BACKFILL"] == "true" and unhosted_videos:
    while unhosted_videos:
        print(f"Found {len(unhosted_videos)} unhosted videos")
        random_unhosted_video = random.choice(unhosted_videos)
        random_video_id = random_unhosted_video["snippet"]["resourceId"]["videoId"]
        random_video_title = random_unhosted_video["snippet"]["title"]
        download_video(random_video_id, extract_audio=False)
        upload_video(random_video_id, random_video_title)
        unhosted_videos = [
            video for video in unhosted_videos
            if video["snippet"]["resourceId"]["videoId"] != random_video_id
        ]
        print("\nHosted random video: " + random_video_title + " (" + random_video_id + ")")
