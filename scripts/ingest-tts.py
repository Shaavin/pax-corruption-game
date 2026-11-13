"""Re-ingest current card faces from the Tabletop Simulator save into public/cards.

Usage (needs Python 3 + Pillow):

    python scripts/ingest-tts.py [path/to/TS_Save_1.json]

Card sheets are cached by TTS in `<Tabletop Simulator>/Mods/Images/`, named after
their URL with every non-alphanumeric character removed. Main-deck faces are
880x1232; they are scaled to 825 wide and center-cropped to the 825x1125 the UI
expects. Decree objectives are square and keep their native size.

See docs/agents/card-catalog.md#tts-deck-map for what each deck holds. Event file
names come from the regular()/legacy() calls in lib/cards/expansion.ts, in TTS order.
"""

import json
import os
import re
import sys
from collections import defaultdict

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARDS = os.path.join(ROOT, "public", "cards")
DEFAULT_SAVE = os.path.expanduser(
    r"~/OneDrive/Documents/My Games/Tabletop Simulator/Saves/TS_Save_1.json"
)
CARD_SIZE = (825, 1125)

# Main deck in TTS order (decks 2 + 3, sorted by CardID): alphabetical per district.
MAIN_ORDER = {
    "dragonara": [
        "Broken Chains", "Civic Council", "District Governor", "District Governor",
        "Dune Clans", "Engineers", "Export Bureau", "Fire Breathers", "Gardeners",
        "Grand Justices", "Kybernetik Inc.", "Order of Knights", "Professors",
        "Programmers", "Robot Factories", "Runes Tavern", "Secret Service",
        "State Enterprise", "Technocrats", "Theft of Thunder", "Think Tanks",
        "Time Committee", "Time Travelers", "Tinkers", "Urban Aristocrats",
        "Winter Castles",
    ],
    "horsard": [
        "Arms Dealers", "Bracket Banks", "Central Bank", "Century Inc.",
        "Consumer Brands", "District Governor", "Estate Moguls", "Export Giants",
        "Film Industry", "Financial Bankers", "Foreign Inc.", "Grassroot Media",
        "Idle Proliferation", "Influencers", "Magistrates", "Masons Guild",
        "Newspapers", "Order of Knights", "Order of Knights", "Prestige Lawyers",
        "Regulators", "Resource Industry", "Transportations", "Urban Planners",
        "Veterans", "Workers Union",
    ],
    "shavvinne": [
        "Architects", "Architecture Inc.", "Artisans", "Buddhist Traders",
        "Civil Advocates", "Diet of Saints", "Divine Inquisitors", "Emirates",
        "Faith Whisperers", "Farmers", "Foreign Inc.", "Grand Maester",
        "Hab Constructors", "Heritage Society", "Hub of Assassins",
        "Local Politicians", "Mining Expats", "Monarch Family", "Order of Knights",
        "Patrons of Art", "Q'iat av Shah Riot", "Rebel Inc.", "Roman Church",
        "Royal Academy", "Teachers", "TuWang Gang",
    ],
    "smarbbit": [
        "Abolitionists", "Anarchists", "Capitol Inc.", "Communists", "Conservatives",
        "Corporatists", "District Governor", "Environmentalists", "Foreign Inc.",
        "Foreign Inc.", "Fundamentalists", "Habitat Directors", "Liberalists",
        "Nationalists", "NGOs", "People's Press", "Power Vacuum", "Preservationists",
        "Project Habitat", "Radio Stations", "Separatists of the Ublozisky Plateau",
        "Socialists", "The Capitalists", "The Middle Class", "The Proletariats",
        "Universities",
    ],
}
MONUMENT_ORDER = [
    "dragon-gate", "intel-network", "planet-next", "space-agency",
    "civil-service", "roman-basilica", "model-society", "smart-doctrine",
]
PARTY_ORDER = [2, 6, 4, 5, 3, 8, 7, 1]  # Conservative, Global, Innovative, ...
EXPANSION_VICTORIES = ["military", "ideological", "popularity", "cultural", "diplomatic"]  # decks 12-16
DECREES = {  # deck: (inactive face, active back)
    17: ("unruly-clans", "imperium"),
    18: ("class-schism", "de-jures"),
    19: ("emigration", "academia"),
    20: ("turmoil-land", "profectus"),
}


def main() -> None:
    save_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SAVE
    images_dir = os.path.join(os.path.dirname(os.path.dirname(save_path)), "Mods", "Images")
    save = json.load(open(save_path, encoding="utf-8"))

    decks: dict[int, dict] = {}
    used: dict[int, set[int]] = defaultdict(set)

    def walk(node):
        if isinstance(node, dict):
            for key, value in (node.get("CustomDeck") or {}).items():
                decks[int(key)] = value
            if "CardID" in node and str(node.get("Name", "")).startswith("Card"):
                used[node["CardID"] // 100].add(node["CardID"] % 100)
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(save)
    cached = os.listdir(images_dir)

    def sheet(url: str) -> Image.Image:
        key = re.sub(r"[^A-Za-z0-9]", "", url)
        match = next((name for name in cached if name.startswith(key)), None)
        if not match:
            raise SystemExit(f"Not cached by TTS: {url}")
        return Image.open(os.path.join(images_dir, match)).convert("RGB")

    def cells(deck_id: int, side: str = "FaceURL") -> list[Image.Image]:
        deck = decks[deck_id]
        image = sheet(deck[side])
        cols, rows = deck["NumWidth"], deck["NumHeight"]
        if cols * rows == 1:
            return [image]
        width, height = image.width // cols, image.height // rows
        return [
            image.crop(((i % cols) * width, (i // cols) * height,
                        (i % cols + 1) * width, (i // cols + 1) * height))
            for i in sorted(used[deck_id])
        ]

    def save_card(image: Image.Image, *parts: str, fit: bool = True) -> None:
        if fit:
            scale = CARD_SIZE[0] / image.width
            image = image.resize((CARD_SIZE[0], round(image.height * scale)), Image.LANCZOS)
            top = (image.height - CARD_SIZE[1]) // 2
            image = image.crop((0, top, CARD_SIZE[0], top + CARD_SIZE[1]))
        path = os.path.join(CARDS, *parts)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        image.save(path, optimize=True)

    # Main deck -> deck/<district>-<a|b|c>-<n>.png, matched by name via lib/cards/deck.ts order.
    deck_ts = open(os.path.join(ROOT, "lib", "cards", "deck.ts"), encoding="utf-8").read()
    repo_ids: dict[tuple[str, str], list[str]] = defaultdict(list)
    for card_id, name in re.findall(r'\(\s*"([a-z]+-[abc]-\d+)",\s*"([^"]+)"', deck_ts):
        repo_ids[(card_id.split("-")[0], name)].append(card_id)

    main = cells(2) + cells(3)
    names = [(d, n) for d, ns in MAIN_ORDER.items() for n in ns]
    if len(main) != len(names) + 4:
        raise SystemExit(f"Expected {len(names) + 4} main-deck faces, got {len(main)}")
    for image, key in zip(main, names):
        save_card(image, "deck", f"{repo_ids[key].pop(0)}.png")
    save_card(main[-1], "deck", "election.png")

    for image, slug in zip(cells(5), MONUMENT_ORDER):
        save_card(image, "monuments", f"{slug}.png")
    for image, order in zip(cells(6), PARTY_ORDER):
        save_card(image, "parties", f"party-{order}.png")
    for deck_id, (inactive, active) in DECREES.items():
        save_card(cells(deck_id)[0], "decrees", f"{inactive}.png", fit=False)
        save_card(cells(deck_id, "BackURL")[0], "decrees", f"{active}.png", fit=False)
    save_card(cells(21, "BackURL")[0], "aids", "victories.png")
    save_card(cells(21)[0], "aids", "actions.png")

    # Legacy & Diplomacy: events (decks 8-11), victory cards (12-16), player aid (1).
    expansion_ts = open(os.path.join(ROOT, "lib", "cards", "expansion.ts"), encoding="utf-8").read()
    slugs = [f"{power}-{slug}" for power, slug in re.findall(r'(?:regular|legacy)\("([a-z]+)", "([a-z0-9-]+)"', expansion_ts)]
    events = cells(8) + cells(9) + cells(10) + cells(11)
    if len(events) != len(slugs) or len(slugs) != 40:
        raise SystemExit(f"Expected 40 event faces and slugs, got {len(events)} and {len(slugs)}")
    for image, slug in zip(events, slugs):
        save_card(image, "expansion", "events", f"{slug}.png")
    save_card(sheet(decks[8]["BackURL"]), "expansion", "events", "back.png")
    for deck_id, victory in zip(range(12, 17), EXPANSION_VICTORIES):
        save_card(cells(deck_id)[0].resize((700, 700), Image.LANCZOS), "expansion", "victories", f"{victory}-inactive.png", fit=False)
        save_card(cells(deck_id, "BackURL")[0].resize((700, 700), Image.LANCZOS), "expansion", "victories", f"{victory}.png", fit=False)
    save_card(cells(1)[0], "expansion", "aids", "actions.png")
    save_card(cells(1, "BackURL")[0], "expansion", "aids", "victories.png")
    print("Ingested main deck, monuments, parties, decrees, player aids, and the Legacy & Diplomacy expansion.")


if __name__ == "__main__":
    main()
