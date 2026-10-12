import internetarchive as ia
import os
import json

ia_email = os.environ["IA_EMAIL"]
query = f"identifier:(fbc_*) AND uploader:({ia_email})"
uploaded_sermons = ia.search_items(query)

print(f"Found {uploaded_sermons.num_found} uploaded sermons")

id_map = {}

for sermon in uploaded_sermons.iter_as_results():
    sermon_id = sermon.get("identifier").removeprefix("fbc_")
    id_map[sermon_id] = True

id_map_path = os.path.join(
    os.path.dirname(__file__),
    "id_map.json"
)
with open(id_map_path, "w") as f:
    json.dump(id_map, f, separators=(",", ":"))

print("Restored ID map")
