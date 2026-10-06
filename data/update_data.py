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

def signal_handler(sig, frame):
    print("You ended the process.")
    subprocess.run(["git", "add", "data/transcripts.json"])
    subprocess.run(["git", "commit", "-m", "Update transcription"])
    subprocess.run(["git", "push", "origin", "main"])
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)

API_KEY = os.environ["API_KEY"]
CHANNEL_ID = "UC6yzBy1Cof8rKcPQtx1XxKQ"

script_path = os.path.dirname(__file__)
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

transcripts_path = os.path.join(script_path, "transcripts.json")
with open(transcripts_path, "r") as json_file:
    transcripts = json.load(json_file)

url_prefix = "https://www.googleapis.com/youtube/v3/"

def load_playwright_cookies(cookie_filepath="lc_cookies.txt"):
    cookies = []
    if not os.path.exists(cookie_filepath):
        return cookies
        
    with open(cookie_filepath, "r") as f:
        for line in f:
            if line.startswith("#") or not line.strip():
                continue
            
            parts = line.strip().split("\t")
            if len(parts) >= 7:
                domain, flag, path, secure, expiration, name, value = parts[:7]
                
                cookie = {
                    "name": name,
                    "value": value,
                    "domain": domain,
                    "path": path,
                    "secure": secure.lower() == "true",
                }
                
                try:
                    cookie["expires"] = float(expiration)
                except ValueError:
                    pass
                    
                cookies.append(cookie)
                
    return cookies

def upload_video(video_id):
    metadata = {
        "mediatype": "movies",
        "title": "FBC Sermon",
        "collection": "fbc_sermons"
    }
    ia.upload(video_id, files=["input.mp4"], metadata=metadata)

    id_map_path = os.path.join(script_path, "id_map.json")
    with open(id_map_path, "r") as json_file:
        id_map = json.load(json_file)
    id_map[video_id] = True
    with open(id_map_path, "w") as f:
        json.dump(id_map, f, separators=(",", ":"))

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

url = url_prefix + "playlists"
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

print("Found " + str(len(playlists)) + " playlists.")
for pl in playlists:
    title = pl["snippet"]["title"]
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
    elif title == "live":
        data_container = [transcripts.setdefault("live", {})]
    else:
        continue

    videos = []
    if title == "live":
        url = url_prefix + "search"
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
        url = url_prefix + "playlistItems"
        params = {
            "part": "snippet",
            "playlistId": pl["id"],
            "maxResults": 1000,
            "key": API_KEY
        }
        videos = iterate_api(url, params)

    print("\n" + str(len(videos)) + " videos found in '" + title + "'.")
    for i, video in enumerate(videos):
        print("\nProcessing video " + str(i + 1) + "/" + str(len(videos)) + ".")
        start_time = time.time()

        video = video["snippet"]

        timestamp = video["title"].split(" ")[0]

        video_data = {
            "name": video["title"],
            "id": video["resourceId"]["videoId"],
            "date": timestamp
        }
        video_container = data_container

        if isGuestSpeakers:
            if "greg ryan" in video_data["name"].lower():
                video_container = video_container["greg_ryan"]
            else:
                video_container = video_container["other"]

        bannedIds = ("eqA-3qW-i8k", "KQvhm6KpBOg", "KQvhm6KpBOg", "5W5xiaEhK9M")
        videoExists = next((x for x in video_container if x["id"] == video_data["id"]), None)
        if not videoExists and not video_data["id"] in bannedIds:
            if title.lower() == "pastor rob mcnutt":
                video_container = transcripts["other"]

            ydl_opts = {
                "cookiefile": "cookies.txt",
                "outtmpl": os.path.join(os.getcwd(), "input.%(ext)s"),
                "remote_components": ["ejs:github"],
            }
            if title != "live":
                ydl_opts.update({
                    "format": "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]",
                    "merge_output_format": "mp4",
                    "postprocessors": [{
                        "key": "FFmpegVideoConvertor",
                        "preferedformat": "mp4",
                    }],
                })
            else:
                ydl_opts.update({
                    "format": (
                        "bestaudio[acodec!=none][language=en]/"
                        "bestaudio[acodec!=none][language=original]/"
                        "bestaudio[acodec!=none]/best"
                    ),
                    "postprocessors": [{
                        "key": "FFmpegExtractAudio",
                        "preferredcodec": "mp3",
                        "preferredquality": "192",
                    }],
                })

            with YoutubeDL(ydl_opts) as ydl:
                ydl.download([
                    "https://www.youtube.com/watch?v=" + video_data["id"]
                ])

            # If not live, upload to hosting service
            if title != "live":
                upload_video(video_data["id"])
                subprocess.run(
                    ["ffmpeg", "-y", "-i", "input.mp4", "-vn", "-ab", "192k", "input.mp3"],
                    check=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE
                )

            whisper_path = os.path.join(os.getcwd(), "whisper-cli")
            whisper_args = [
                "-m", "ggml-tiny.en.bin",
                "-f", "input.mp3",
                "--output-json",
                "-of", "output"
            ]
            subprocess.run([whisper_path] + whisper_args)

            with open("output.json", "r") as json_file:
                video_transcript = json.load(json_file)

            os.remove("input.mp3")

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

            if title == "live":
                transcripts["live"] = video_data
            else:
                video_container.append(video_data)

            with open(transcripts_path, "w") as f:
                json.dump(transcripts, f, separators=(",", ":"))

            end_time = time.time()
            elapsed = int(end_time - start_time)
            minutes = elapsed // 60
            seconds = elapsed % 60
            print(f"\nCompleted video in {minutes:02d}:{seconds:02d}")

