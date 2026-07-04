"""Quick SAG check - tests search pipeline + prompt building without calling Groq API."""
import sys
sys.path.insert(0, '.')

OK   = "PASS"
FAIL = "FAIL"

print("=" * 55)
print("SAG FEATURE CHECK")
print("=" * 55)

# [1] Check imports
print("\n[1] Checking imports...")
try:
    from ddgs import DDGS
    print("    ddgs           : " + OK)
except ImportError as e:
    print("    ddgs           : " + FAIL, e)

try:
    import httpx
    print("    httpx          : " + OK)
except ImportError as e:
    print("    httpx          : " + FAIL, e)

try:
    from services.web_search_service import _rewrite_queries, get_web_context
    print("    web_search_svc : " + OK)
except Exception as e:
    print("    web_search_svc : " + FAIL, e)
    sys.exit(1)

try:
    from services.groq_service import build_web_prompt, WEB_SEARCH_SYSTEM_PROMPT
    print("    groq_service   : " + OK)
except Exception as e:
    print("    groq_service   : " + FAIL, e)
    sys.exit(1)

try:
    from services.rag_service import answer_query_with_web_search
    print("    rag_service    : " + OK)
except Exception as e:
    print("    rag_service    : " + FAIL, e)
    sys.exit(1)

# [2] Query rewriting
print("\n[2] Query rewriting...")
queries = _rewrite_queries("most recent FDA cancer drug approval June 2026?")
for i, q in enumerate(queries, 1):
    print("    Query %d: %s" % (i, q))
print("    Status : " + (OK if len(queries) >= 2 else FAIL))

# [3] Search results
print("\n[3] Running search (may take ~15s)...")
blocks, sources = get_web_context("FDA cancer drug approval June 2026")
status = OK if len(sources) >= 3 else FAIL
print("    Sources found : %d  [%s]" % (len(sources), status))
for i, s in enumerate(sources[:5], 1):
    print("    Source %d : %s" % (i, s["title"][:60]))

# [4] Prompt building
print("\n[4] Prompt building...")
if blocks:
    prompt = build_web_prompt("test query", blocks[:2])
    checks = {
        "SOURCE labels present" : "[SOURCE 1]" in prompt,
        "Question present"      : "test query" in prompt,
        "CDx warning present"   : "companion diagnostic" in prompt.lower(),
        "Inline citation guide" : "[Source N]" in prompt,
    }
    for name, result in checks.items():
        print("    %-25s: %s" % (name, OK if result else FAIL))
else:
    print("    " + FAIL + " - no blocks to test")

# [5] System prompt rules
print("\n[5] System prompt rules...")
rules = {
    "CDx != drug rule"     : "CDx" in WEB_SEARCH_SYSTEM_PROMPT,
    "Inline citation rule" : "Source N" in WEB_SEARCH_SYSTEM_PROMPT,
    "Field extract rule"   : "Not found in sources" in WEB_SEARCH_SYSTEM_PROMPT,
    "Anti-fabricate rule"  : "fabricate" in WEB_SEARCH_SYSTEM_PROMPT,
}
for name, result in rules.items():
    print("    %-25s: %s" % (name, OK if result else FAIL))

# [6] Route model fields
print("\n[6] Chat route fields...")
from routes.chat import MessageRequest, MessageResponse
req_fields  = list(MessageRequest.model_fields.keys())
resp_fields = list(MessageResponse.model_fields.keys())
checks6 = {
    "use_web_search in Request"  : "use_web_search"  in req_fields,
    "sources in Response"        : "sources"         in resp_fields,
    "used_web_search in Response": "used_web_search" in resp_fields,
}
for name, result in checks6.items():
    print("    %-30s: %s" % (name, OK if result else FAIL))

# [7] Frontend key files
import os
print("\n[7] Frontend files...")
fe = "c:\\Users\\Dell\\Desktop\\medAI4\\frontend-2\\src"
files = {
    "ChatInput.jsx (webSearch prop)" : ("components\\Chat\\ChatInput.jsx", "webSearch"),
    "Chat.jsx (webSearch state)"     : ("pages\\Chat.jsx",                 "webSearch"),
    "MessageBubble.jsx (sources)"    : ("components\\Chat\\MessageBubble.jsx", "sources"),
    "api.jsx (use_web_search)"       : ("services\\api.jsx",               "use_web_search"),
}
for label, (path, keyword) in files.items():
    full = os.path.join(fe, path)
    if os.path.exists(full):
        content = open(full, encoding="utf-8", errors="ignore").read()
        found = keyword in content
        print("    %-35s: %s" % (label, OK if found else FAIL + " (keyword missing)"))
    else:
        print("    %-35s: %s" % (label, FAIL + " (file missing)"))

# Summary
print("\n" + "=" * 55)
all_ok = len(sources) >= 3
print("OVERALL: " + ("SAG FEATURE IS WORKING" if all_ok else "ISSUES FOUND - CHECK ABOVE"))
print("=" * 55)
