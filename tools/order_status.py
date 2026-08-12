#!/usr/bin/env python3
"""Set, clear or list LUMIA order statuses (assets/order-status.json).

The dealer's order page reads this file: an order whose ref appears here
moves to the "Accepted" section and shows the status; locked orders can
no longer be edited or removed by the dealer.

Usage:
  python3 tools/order_status.py LMA-260813-903 "In production" --lock --note "ETA Aug 25"
  python3 tools/order_status.py LMA-260813-903 "Shipped" --lock
  python3 tools/order_status.py LMA-260813-903 --clear
  python3 tools/order_status.py --list

Then commit + push to publish.
"""
import argparse
import json
import pathlib

FILE = pathlib.Path(__file__).parent.parent / "assets" / "order-status.json"


def load():
    return json.loads(FILE.read_text()) if FILE.exists() else {}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ref", nargs="?", help="order reference, e.g. LMA-260813-903")
    ap.add_argument("status", nargs="?", help='status text, e.g. "In production"')
    ap.add_argument("--lock", action="store_true", help="block dealer edit/remove")
    ap.add_argument("--note", default="", help="short note shown to the dealer")
    ap.add_argument("--clear", action="store_true", help="remove the entry (back to Pending)")
    ap.add_argument("--list", action="store_true", help="show all entries")
    args = ap.parse_args()

    data = load()
    if args.list or not args.ref:
        for ref, e in data.items():
            print(f"{ref}: {e['status']}{' [LOCKED]' if e.get('locked') else ''}"
                  f"{' — ' + e['note'] if e.get('note') else ''}")
        if not data:
            print("(no statuses set)")
        return

    if args.clear:
        data.pop(args.ref, None)
        print(f"cleared {args.ref}")
    else:
        if not args.status:
            ap.error("status text required (or use --clear / --list)")
        data[args.ref] = {"status": args.status, "locked": args.lock}
        if args.note:
            data[args.ref]["note"] = args.note
        print(f"{args.ref} -> {args.status}{' [LOCKED]' if args.lock else ''}")

    FILE.write_text(json.dumps(data, indent=1))
    print(f"wrote {FILE} — commit and push to publish")


if __name__ == "__main__":
    main()
