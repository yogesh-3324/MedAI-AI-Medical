import sys
sys.path.insert(0, '.')

from services.web_search_service import _rewrite_queries, get_web_context

q = "what was the most recent FDA approval for a cancer drug in June 2026?"

print("=== REWRITTEN QUERIES ===")
queries = _rewrite_queries(q)
for i, qry in enumerate(queries, 1):
    print(f"  {i}. {qry}")

print()
print("=== RUNNING MULTI-QUERY SEARCH ===")
blocks, sources = get_web_context(q)
print(f"Got {len(blocks)} context blocks, {len(sources)} sources")
print()
for idx, s in enumerate(sources, 1):
    title = s["title"][:65]
    url   = s["url"][:70]
    print(f"  Source {idx}: {title}")
    print(f"           {url}")
print()
print("=== FIRST BLOCK CONTENT PREVIEW (500 chars) ===")
if blocks:
    print(blocks[0]["content"][:500])
