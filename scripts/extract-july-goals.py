#!/usr/bin/env python3
"""Extract goals under July headers from Goals for July xlsx into src/db/july-goals.json."""
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
XLSX_CANDIDATES = [
    ROOT / "Goals for July.xlsx",
    ROOT.parent / "Goals for July (1).xlsx",
    Path("/Users/noorgupta/Downloads/Goals for July (1).xlsx"),
]
OUT = ROOT / "src/db/july-goals.json"

SEED_NAMES = {
    "Noor Gupta", "Abhishek Rathore", "Anjali Rawat", "Dheeraj", "Satyavrat Sharma", "Swati Juyal",
    "Apoorv Suman", "Aalim", "Anmol Anand", "Manish Singh Mahant", "Manoj Kumar", "Vikas Kumar",
    "Ankush Chaudhary", "Bhavya Oberoi", "Vaishnavi Mishra", "Supriya CK", "Chandan Kumar Vishwakarma",
    "Harshita Varshney", "Tilak Mahawar", "Tushar Kumar", "Anubha Rathi", "Abhishek Shukla", "Aman Ghosh",
    "Amit Joshi", "Ishika Badal", "Mayank Chauhan", "Piyush Vaid", "Pranchal Chaudhary", "Raj", "Rakhi Dhama",
    "Shreya Sarawagi", "Vaibhav Singhal", "Bhavya S Menon", "Aman Deep", "Amardeep Singh", "Ashutosh Kaushik",
    "Naveen Tiwari", "Rahul", "Bratish Kanti Banerjee", "Ajay Singh Rawat", "Akriti Singh", "Deepak Kumar",
    "MD Wasim", "Harish Rawat", "Abhishek Sharma", "Divyanshu Mishra", "Rishabh Bangwal", "Nishita Gupta",
    "Sahil Mathur", "Shuchita Kumar", "Pulkit Lalwani", "Piyush Kumar", "Tanya Khanna", "Anish Mohan",
    "Khushi Narula", "Rohit Sondhi", "Satyam Gupta", "Siya Khanna", "Vandit Rai", "Mod Abid", "Mudhit Mehra",
    "Aastha Gupta",
}

ALIASES = {
    "vaibhav": "Vaibhav Singhal", "shreya": "Shreya Sarawagi", "aman ghosh": "Aman Ghosh", "aman deep": "Aman Deep",
    "amandeep": "Aman Deep", "mayank": "Mayank Chauhan", "amit": "Amit Joshi", "piyush vaid": "Piyush Vaid",
    "piyush kumar": "Piyush Kumar", "kumar priyanshu": "Piyush Kumar", "abhishek shukla": "Abhishek Shukla",
    "abhishek sharma": "Abhishek Sharma", "abhishek": "Abhishek Sharma", "pranchal": "Pranchal Chaudhary",
    "raj": "Raj", "rakhi": "Rakhi Dhama", "ishika": "Ishika Badal", "anubha": "Anubha Rathi",
    "chandan": "Chandan Kumar Vishwakarma", "harshita": "Harshita Varshney", "supriya": "Supriya CK",
    "supriya ck": "Supriya CK", "tilak": "Tilak Mahawar", "tushar": "Tushar Kumar", "pulkit lalwani": "Pulkit Lalwani",
    "manoj": "Manoj Kumar", "anmol": "Anmol Anand", "vikas": "Vikas Kumar", "manish": "Manish Singh Mahant",
    "apoorv": "Apoorv Suman", "amardeep": "Amardeep Singh", "naveen": "Naveen Tiwari", "ashutosh": "Ashutosh Kaushik",
    "rahul": "Rahul", "bhavya s menon": "Bhavya S Menon", "tanya": "Tanya Khanna", "siya": "Siya Khanna",
    "khushi": "Khushi Narula", "rohit": "Rohit Sondhi", "anish": "Anish Mohan", "anish sir": "Anish Mohan",
    "noor": "Noor Gupta", "ankush": "Ankush Chaudhary", "vaishnavi": "Vaishnavi Mishra", "bhavya oberoi": "Bhavya Oberoi",
    "dheeraj": "Dheeraj", "anjali": "Anjali Rawat", "satyavrat": "Satyavrat Sharma", "swati juyal": "Swati Juyal",
    "swati": "Swati Juyal", "harish": "Harish Rawat", "divyanshu": "Divyanshu Mishra", "rishabh": "Rishabh Bangwal",
    "nishita": "Nishita Gupta", "sahil": "Sahil Mathur", "shuchita": "Shuchita Kumar",
    "akriti": "Akriti Singh", "ajay": "Ajay Singh Rawat", "wasim": "MD Wasim",
    "deepak": "Deepak Kumar", "bratish": "Bratish Kanti Banerjee", "aastha": "Aastha Gupta",
    "abhishek rathore": "Abhishek Rathore",
}

GRAPHICS_SHEET = "xl/worksheets/sheet1.xml"
# Whole-tab July goals (no explicit "July" row on the sheet)
JULY_ONLY_SHEETS = {
    "xl/worksheets/sheet2.xml",   # Editing 1
    "xl/worksheets/sheet12.xml",  # Partnerships
    "xl/worksheets/sheet13.xml",  # HR
}


def col_idx(ref: str) -> int:
    letters = re.match(r"([A-Z]+)", ref).group(1)
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())


def read_xlsx(path: Path, max_cols: int = 8) -> dict:
    with zipfile.ZipFile(path) as z:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in z.namelist():
            root = ET.fromstring(z.read("xl/sharedStrings.xml"))
            ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
            for si in root.findall(".//m:si", ns):
                shared.append("".join([(t.text or "") for t in si.findall(".//m:t", ns)]))
        sheets = {}
        for sn in sorted(n for n in z.namelist() if re.match(r"xl/worksheets/sheet\d+\.xml$", n)):
            sheet = ET.fromstring(z.read(sn))
            ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
            rows = []
            for row in sheet.findall(".//m:sheetData/m:row", ns):
                arr = [""] * max_cols
                for c in row.findall("m:c", ns):
                    ref = c.get("r")
                    t = c.get("t")
                    v = c.find("m:v", ns)
                    if v is None:
                        continue
                    val = shared[int(v.text)] if t == "s" else v.text
                    arr[col_idx(ref)] = str(val).strip()
                rows.append(arr)
            sheets[sn] = rows
    return sheets


def is_sheet_month_header(row: list[str], month: str) -> bool:
    if norm(row[0]).lower() == month:
        return True
    cells = [norm(c).lower() for c in row if c]
    return len(cells) == 1 and cells[0] == month


def is_header(row: list[str]) -> bool:
    return "team member" in " ".join(row).lower()


def detect_layout(row: list[str]) -> str:
    jl = " ".join(row).lower()
    if row[0].lower().startswith("team member") and row[1] == "" and "personal goal" in jl and "business goal" in jl:
        return "tech"
    if "measured by" in jl and "personal goal" in jl:
        return "varsity"
    if "personal goal" in jl and "business goal" in jl and len(row) <= 5:
        return "short"
    return "standard"


def resolve_name(raw: str, sheet_id: str) -> str | None:
    key = norm(raw).lower().replace("(self)", "").strip()
    if not key or key == "deepak ch":
        return None
    if key == "piyush" and sheet_id == GRAPHICS_SHEET:
        return "Piyush Vaid"
    if key == "aman" and sheet_id == GRAPHICS_SHEET:
        return "Aman Ghosh"
    if key == "bhavya" and sheet_id == "xl/worksheets/sheet10.xml":
        return "Bhavya S Menon"
    if key in ALIASES:
        return ALIASES[key]
    if key == "abhishek" and sheet_id == "xl/worksheets/sheet3.xml":
        return "Abhishek Sharma"
    if key == "abhishek" and sheet_id == "xl/worksheets/sheet12.xml":
        return "Abhishek Rathore"
    for n in SEED_NAMES:
        nl = n.lower()
        if key == nl or nl.startswith(key + " ") or (len(key) > 3 and key in nl):
            return n
    return None


def add_goal(goals: list, person: str | None, gtype: str, text: str, measure: str) -> None:
    text = norm(text)
    if not text or not person or person not in SEED_NAMES:
        return
    desc = text + (f"\n\nMeasure: {norm(measure)}" if norm(measure) else "")
    title = text if len(text) <= 100 else text[:97] + "..."
    goals.append({"name": person, "goalType": gtype, "title": title, "description": desc})


def month_in_row(row: list[str]) -> str:
    for i in (0, 1):
        m = norm(row[i]).lower()
        if m in ("july", "august"):
            return m
    return ""


def is_august_continuation(row: list[str]) -> bool:
    """Skip continuation rows that are explicitly August goals."""
    blob = norm(" ".join(row)).lower()
    return blob.startswith("in august") or blob.startswith("august ")


def parse_sheet(rows: list[list[str]], sheet_id: str) -> list[dict]:
    goals: list[dict] = []
    july_only_sheet = sheet_id in JULY_ONLY_SHEETS
    mode = "july" if july_only_sheet else None
    layout = "standard"
    current_person = None
    last_july_person = None
    seen_july_header = july_only_sheet

    for row in rows:
        if is_sheet_month_header(row, "august"):
            mode = "august"
            continue
        if is_sheet_month_header(row, "july"):
            mode = "july"
            seen_july_header = True
            continue
        if is_header(row):
            layout = detect_layout(row)
            if layout == "tech":
                seen_july_header = True
            continue

        if layout == "tech":
            if row[0]:
                current_person = resolve_name(row[0], sheet_id)
                if current_person:
                    last_july_person = current_person
            if month_in_row(row) == "july":
                person = current_person or last_july_person
                add_goal(goals, person, "personal", row[2], row[3])
                add_goal(goals, person, "business", row[4], row[5])
            elif month_in_row(row) == "" and not row[0]:
                biz = row[4] or row[3]
                if biz and last_july_person:
                    add_goal(goals, last_july_person, "business", biz, row[5] if row[4] else row[4])
            continue

        if not seen_july_header or mode != "july":
            continue

        if is_august_continuation(row):
            continue

        person = resolve_name(row[0], sheet_id)
        if person:
            last_july_person = person
            add_goal(goals, person, "personal", row[1], row[2])
            add_goal(goals, person, "business", row[3], row[4])
        elif last_july_person and row[3] and not row[1]:
            add_goal(goals, last_july_person, "business", row[3], row[4])

    return goals


def main() -> None:
    xlsx = next((p for p in XLSX_CANDIDATES if p.exists()), None)
    if not xlsx:
        print("No xlsx found. Place 'Goals for July.xlsx' in project root.", file=sys.stderr)
        sys.exit(1)

    sheets = read_xlsx(xlsx)
    all_goals: list[dict] = []
    for sid, rows in sheets.items():
        all_goals.extend(parse_sheet(rows, sid))

    seen: set[tuple] = set()
    unique: list[dict] = []
    for g in all_goals:
        key = (g["name"], g["goalType"], g["title"])
        if key not in seen:
            seen.add(key)
            unique.append(g)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(unique, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(unique)} July goals for {len(set(g['name'] for g in unique))} people -> {OUT}")


if __name__ == "__main__":
    main()
