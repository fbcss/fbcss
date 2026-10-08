from yt_dlp import YoutubeDL
import os
import shutil
import subprocess
import json

id = "eewz7zbjQHo"

def download_video():
    ydl_opts = {
        "cookiefile": "cookies.txt",
        "outtmpl": os.path.join(os.getcwd(), "input.%(ext)s"),
        "remote_components": ["ejs:github"],
        "postprocessor_args": {"extractaudio": ["-ar", "16000", "-ac", "1"]},
        "format": (
            "bestaudio[acodec!=none][language=en]/"
                "bestaudio[acodec!=none][language=original]/"
                "bestaudio[acodec!=none]/best"
        ),
        "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "wav"}],
    }

    print("Downloading video...")
    with YoutubeDL(ydl_opts) as ydl:
        ydl.download([f"https://www.youtube.com/watch?v={id}"])
    print("Successfully downloaded video.")

download_video()

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
print("Successfully transcribed video.")

with open("output.json", "r") as json_file:
    video_transcript = json.load(json_file)

os.remove("input.wav")

video_transcript = video_transcript["transcription"]
segments = [
    (s["offsets"]["from"] / 1000, s["offsets"]["to"] / 1000, s["text"])
    for s in video_transcript
]

step = 60
total = segments[-1][1]
# words per minute in each 60s bucket, counting only speech time
buckets = [0] * (int(total // step) + 1)
for s, e, text in segments:
    buckets[int(s // step)] += len(text.split())
    # a bucket is "sermon-like" if it holds roughly 100+ words (~speaking pace)
    good = [w >= 100 for w in buckets]
    # find the longest run, allowing 1-bucket dips for pauses
    best, cur_start, gap = (0, 0), None, 0
    for i, g in enumerate(good + [False, False]):
        if g:
            if cur_start is None: cur_start = i
            gap = 0
        elif cur_start is not None:
            gap += 1
            if gap > 1:
                end = i - gap + 1
                if end - cur_start > best[1] - best[0]:
                    best = (cur_start, end)
                cur_start, gap = None, 0
sermon_section = best[0] * step, best[1] * step

print(sermon_section)

