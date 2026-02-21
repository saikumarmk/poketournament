#!/usr/bin/env python3
"""
Compute Elo ratings via logistic regression, matching the methodology from
github.com/jsettlem/elo_world_pokemon_crystal (pimanrules).

Uses sklearn's LogisticRegression (L-BFGS solver, C=1.0) on a paired-comparison
feature matrix: each battle produces a row with +1 at the winner column and -1
at the loser column. Ties count as one win each direction.
"""

import json
import os
import sys
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression


def compute_elo(battles: list[dict], trainer_ids: list[str]) -> dict[str, float]:
    N = len(trainer_ids)
    idx = {tid: i for i, tid in enumerate(trainer_ids)}

    X_rows = []
    Y_rows = []

    for b in battles:
        i = idx.get(b["player1"])
        j = idx.get(b["player2"])
        if i is None or j is None or i == j:
            continue
        outcome = b["outcome"]
        if outcome == "error":
            continue

        if outcome == "p1":
            v = np.zeros(N)
            v[i] = 1
            v[j] = -1
            X_rows.append(v)
            Y_rows.append(True)
        elif outcome == "p2":
            v = np.zeros(N)
            v[i] = 1
            v[j] = -1
            X_rows.append(v)
            Y_rows.append(False)
        else:  # tie
            v = np.zeros(N)
            v[i] = 1
            v[j] = -1
            X_rows.append(v)
            Y_rows.append(True)
            X_rows.append(v.copy())
            Y_rows.append(False)

    if not X_rows:
        return {tid: 1500.0 for tid in trainer_ids}

    X = np.array(X_rows)
    Y = np.array(Y_rows)

    clf = LogisticRegression(max_iter=1000, C=1.0)
    clf.fit(X, Y)

    elo_values = clf.coef_[0] * 173 + 1500
    return {tid: float(elo_values[i]) for i, tid in enumerate(trainer_ids)}


def calculate(suffix: str, input_dir: Path, out_dir: Path):
    trainers_path = input_dir / f"trainers{suffix}.json"
    battles_path = input_dir / f"battles{suffix}.json"

    if not battles_path.exists():
        print(f"Skipping {suffix or 'normal'} — no battles file found")
        return

    trainers = json.loads(trainers_path.read_text())
    battles = json.loads(battles_path.read_text())
    trainer_ids = [f"{t['name']}-{t['location']}" for t in trainers]

    # Win/loss/draw stats
    stats: dict[str, dict[str, int]] = {tid: {"win": 0, "loss": 0, "draw": 0} for tid in trainer_ids}
    for b in battles:
        s1 = stats.get(b["player1"])
        s2 = stats.get(b["player2"])
        if not s1 or not s2:
            continue
        if b["outcome"] == "p1":
            s1["win"] += 1
            s2["loss"] += 1
        elif b["outcome"] == "p2":
            s1["loss"] += 1
            s2["win"] += 1
        elif b["outcome"] == "tie":
            s1["draw"] += 1
            s2["draw"] += 1

    print(f"[{suffix or 'normal'}] Computing Elo from {len(battles)} battles across {len(trainers)} trainers...")
    elo_map = compute_elo(battles, trainer_ids)

    # Best win / worst loss
    best_wins: dict[str, dict] = {}
    worst_losses: dict[str, dict] = {}

    for b in battles:
        if b["outcome"] in ("error", "tie"):
            continue
        if b["player1"] == b["player2"]:
            continue

        winner_id = b["player1"] if b["outcome"] == "p1" else b["player2"]
        loser_id = b["player2"] if b["outcome"] == "p1" else b["player1"]
        winner_elo = elo_map.get(winner_id, 1500)
        loser_elo = elo_map.get(loser_id, 1500)

        cur_best = best_wins.get(winner_id)
        if not cur_best or loser_elo > cur_best["elo"]:
            best_wins[winner_id] = {"id": loser_id, "elo": round(loser_elo, 2)}

        cur_worst = worst_losses.get(loser_id)
        if not cur_worst or winner_elo < cur_worst["elo"]:
            worst_losses[loser_id] = {"id": winner_id, "elo": round(winner_elo, 2)}

    # Build rankings
    rankings = []
    for i, t in enumerate(trainers):
        tid = trainer_ids[i]
        s = stats[tid]
        entry = {
            "name": t["name"],
            "location": t["location"],
            "id": tid,
            "elo": round(elo_map[tid], 2),
            "win": s["win"],
            "loss": s["loss"],
            "draw": s["draw"],
            "bestWin": best_wins.get(tid),
            "worstLoss": worst_losses.get(tid),
            "pokemon": t["pokemon"],
        }
        for key in ("modifiers", "trainerClass", "aiFlags", "switchFlag", "trainerItems", "itemUseFlag"):
            if key in t:
                entry[key] = t[key]
        rankings.append(entry)

    rankings.sort(key=lambda r: r["elo"], reverse=True)

    out_dir.mkdir(parents=True, exist_ok=True)
    rankings_path = out_dir / f"rankings{suffix}.json"
    rankings_path.write_text(json.dumps(rankings, separators=(",", ":")))

    # Matchup matrix
    N = len(trainer_ids)
    idx = {tid: i for i, tid in enumerate(trainer_ids)}
    flat = [[0, 0, 0] for _ in range(N * N)]

    for b in battles:
        if b["outcome"] == "error":
            continue
        i = idx.get(b["player1"])
        j = idx.get(b["player2"])
        if i is None or j is None or i == j:
            continue
        if b["outcome"] == "p1":
            flat[i * N + j][0] += 1
            flat[j * N + i][1] += 1
        elif b["outcome"] == "p2":
            flat[i * N + j][1] += 1
            flat[j * N + i][0] += 1
        else:
            flat[i * N + j][2] += 1
            flat[j * N + i][2] += 1

    matchups_path = out_dir / f"matchups{suffix}.json"
    matchups_path.write_text(json.dumps({"idx": trainer_ids, "data": flat}, separators=(",", ":")))

    rank_kb = rankings_path.stat().st_size / 1024
    match_kb = matchups_path.stat().st_size / 1024
    print(f"Wrote rankings{suffix}.json ({rank_kb:.0f} KB), matchups{suffix}.json ({match_kb:.0f} KB)")
    print(f"\nTop 10:")
    for r in rankings[:10]:
        print(f"  {r['elo']:>7.0f} | {r['name']} ({r['location']}) — W:{r['win']} L:{r['loss']} D:{r['draw']}")
    print(f"\nBottom 5:")
    for r in rankings[-5:]:
        print(f"  {r['elo']:>7.0f} | {r['name']} ({r['location']}) — W:{r['win']} L:{r['loss']} D:{r['draw']}")
    print()


def main():
    gen = sys.argv[1] if len(sys.argv) > 1 else "gen1"
    script_dir = Path(__file__).parent
    input_dir = script_dir.parent / "data"
    out_dir = script_dir.parent / "public" / "data"

    suffixes = ["-gen2", "-gen2-lv50"] if gen == "gen2" else ["", "-lv50"]
    for suffix in suffixes:
        calculate(suffix, input_dir, out_dir)


if __name__ == "__main__":
    main()
