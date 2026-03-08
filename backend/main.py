from fastapi import FastAPI, Query, HTTPException
from datetime import datetime
import httpx
import os
from dotenv import load_dotenv
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
import certifi
import secrets
from fastapi.middleware.cors import CORSMiddleware
from math import inf 
import math

load_dotenv()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

x_api_key = os.getenv("x_api_key")

mongo_uri = os.getenv("MONGO_URI")
client = AsyncIOMotorClient(mongo_uri, tlsCAFile=certifi.where())
db = client["UserData"]
user_collections = db["userDeats"]


class LoginFormat(BaseModel):
    email: str
    password: str

class LoginOutput(BaseModel):
    token: str
    message: str

class TokenInput(BaseModel):
    token: str

class EventOutput(BaseModel):
    events: list


def get_headers() -> dict:
    if not x_api_key:
        raise HTTPException(status_code=500, detail="x_api_key environment variable is not set")
    return {"x-api-key": x_api_key}


@app.get("/")
async def root():
    return {"message": "Hello from server", "time": str(datetime.now())}


@app.post("/login", response_model=LoginOutput)
async def login(user: LoginFormat):
    db_user = await user_collections.find_one({"email": user.email})
    if not db_user:
        raise HTTPException(status_code=401, detail="User was never made")
    if db_user.get("password") != user.password:
        raise HTTPException(status_code=401, detail="User password was wrong")

    token = secrets.token_hex(16)
    await user_collections.update_one({"email": user.email}, {"$set": {"token": token}})
    return {"token": token, "message": "Logged in properly"}


@app.get("/pastEvent")
async def past_event(token: str):
    user = await user_collections.find_one({"token": token})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user.get("past_events", [])


@app.get("/autocomplete")
async def autocomplete(q: str = Query("")):
    if not q.strip():
        return []

    url = "https://api.utdnebula.com/rooms"
    headers = get_headers()

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()

    data = response.json()
    buildings = data.get("data", [])

    results = []
    query_lower = q.strip().lower()

    for building in buildings:
        building_name = building.get("building", "")
        tb = building.get("building")
        for room in building.get("rooms", []):
            room_code = room.get("room", "")
            full_code = tb + " " + room_code
            has_digit = any(c.isdigit() for c in full_code)
            matches_query = query_lower in building_name.lower() or query_lower in room_code.lower()
            if matches_query and has_digit:
                results.append(full_code)
            if len(results) >= 5:
                break
        if len(results) >= 5:
            break

    return results


@app.get("/history")
async def history():
    return [
        {"name": "ECSW 1.315", "subtitle": "Engineering and Computer Science West", "date": "Mar 6", "time": "2:30 PM"},
        {"name": "SLC 1.102", "subtitle": "Student Learning Center", "date": "Mar 5", "time": "10:00 AM"},
        {"name": "GR 2.302",  "subtitle": "Green Center", "date": "Mar 4", "time": "4:00 PM"},
    ]


@app.get("/events")
async def event_info():
    date = datetime.now().strftime("%Y-%m-%d")
    url = f"https://api.utdnebula.com/mazevo/{date}"
    headers = get_headers()

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()

    data = response.json()
    events = []
    event_date = data["data"].get("date", date)
    buildings = data["data"].get("buildings", [])

    for building in buildings:
        building_name = building.get("building")
        for room in building.get("rooms", []):
            room_name = room.get("room", "")
            location = building_name + " " + room_name
            has_digit = any(c.isdigit() for c in location)
            for event in room.get("events", []):
                name = event.get("eventName") or event.get("section", "")
                filtered_name = name and "No Event Requesting" not in name
                if filtered_name and has_digit:
                    start = event.get("start_time", "")
                    end = event.get("end_time", "")
                    time_str = f"{start} - {end}" if start and end else start or end
                    events.append({"name": location, "subtitle": name, "date": event_date, "time": time_str})
                if len(events) >= 3:
                    break
            if len(events) >= 3:
                break
        if len(events) >= 3:
            break

    return events



#Advanced Path Stuff


#Floyd Warshall is the optimal graph algo to use. It preprocesses the fastest path from node to any other node so its really good for finding paths with multiple queries.
NODES = []
EDGES = []

def build_floyd_warshall():
    node_ids = [n["id"] for n in NODES]
    idx = {nid: i for i, nid in enumerate(node_ids)}
    n = len(node_ids)

    dist = [[inf] * n for _ in range(n)]
    next_node = [[None] * n for _ in range(n)]

    for i in range(n):
        dist[i][i] = 0
        next_node[i][i] = i

    for u, v, w in EDGES:
        dist[idx[u]][idx[v]] = w
        dist[idx[v]][idx[u]] = w
        next_node[idx[u]][idx[v]] = idx[v]
        next_node[idx[v]][idx[u]] = idx[u]

    for k in range(n):
        for i in range(n):
            for j in range(n):
                if dist[i][k] + dist[k][j] < dist[i][j]:
                    dist[i][j] = dist[i][k] + dist[k][j]
                    next_node[i][j] = next_node[i][k]

    return node_ids, dist, next_node

NODE_IDS, DIST_MATRIX, NEXT_NODE = build_floyd_warshall()
NODE_IDX = {nid: i for i, nid in enumerate(NODE_IDS)}  # was NODES_IDS

def get_distance(a: str, b: str) -> float:
    i, j = NODE_IDX[a], NODE_IDX[b]
    return DIST_MATRIX[i][j]

def reconstruct_path(a: str, b: str) -> list[str]:
    i, j = NODE_IDX[a], NODE_IDX[b]
    if NEXT_NODE[i][j] is None:
        return []
    path = [a]
    while i != j:
        i = NEXT_NODE[i][j]
        path.append(NODE_IDS[i])
    return path

@app.get("/distance")
async def distance(a: str, b: str):
    if a not in NODE_IDX or b not in NODE_IDX:
        raise HTTPException(status_code=404, detail="Node not found")  # was details=
    return {"from": a, "to": b, "distance": get_distance(a, b)}

@app.get("/path")
async def path(a: str, b: str):
    if a not in NODE_IDX or b not in NODE_IDX:
        raise HTTPException(status_code=404, detail="Node not found")
    nodes = reconstruct_path(a, b)
    if not nodes:
        raise HTTPException(status_code=404, detail="No path exists")
    return {"from": a, "to": b, "distance": get_distance(a, b), "path": nodes}

offset = 0.0001


#This is some really cool 2 pointer stuff to reduce the nodes we use making users not hate us. Basically the idea is that for this the two pointer smake it so that moves that change either your longitude and latitude by an equivalenet amount dont need to be done in succesion and by using two pointers you can slowly remove unesscary ndoes getting a path that consists of the least amount of nodes
def get_axis(a, b) -> str | None: 
    lat_diff = abs(a["lat"] - b["lat"]) > offset
    lng_diff = abs(a["lng"] - b["lng"]) > offset
    if lat_diff and not lng_diff: 
        return "lat"
    if lng_diff and not lat_diff:
        return "lng"
    return None

def remove_redundant_nodes(path: list[dict]) -> list[dict]:
    if len(path) <= 2:
        return path

    result = [path[0]]
    left = 0
    current_axis = get_axis(path[left], path[1])  

    for right in range(1, len(path)):
        new_axis = get_axis(path[left], path[right])
        if new_axis != current_axis:
            result.append(path[right - 1])
            left = right - 1
            current_axis = get_axis(path[left], path[right])

    result.append(path[-1])
    return result

async def load_graph():
    raw_nodes = await db["nodes"].find().to_list(length=None)
    
    node_map = {n["id"]: n for n in raw_nodes}
    
    NODES.clear()
    EDGES.clear()
    
    seen_edges = set()
    
    for node in raw_nodes:
        NODES.append({"id": node["id"], "lat": node["Latitude"], "lng": node["Longitude"]})
        
        for neighbor_id in node.get("edges", []):
            edge_key = tuple(sorted([node["id"], neighbor_id]))
            if edge_key in seen_edges:
                continue
            seen_edges.add(edge_key)
            
            neighbor = node_map.get(neighbor_id)
            if not neighbor:
                continue
            
            dlat = node["Latitude"] - neighbor["Latitude"]
            dlng = node["Longitude"] - neighbor["Longitude"]
            weight = math.sqrt(dlat**2 + dlng**2)
            
            EDGES.append((node["id"], neighbor_id, weight))
    
    global NODE_IDS, DIST_MATRIX, NEXT_NODE, NODE_IDX
    NODE_IDS, DIST_MATRIX, NEXT_NODE = build_floyd_warshall()
    NODE_IDX = {nid: i for i, nid in enumerate(NODE_IDS)}

@app.on_event("startup")
async def startup():
    await load_graph()
