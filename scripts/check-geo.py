#!/usr/bin/env python3
"""Verify the crawlable GEO contract against a running Next.js server.

Usage: python3 scripts/check-geo.py http://127.0.0.1:3011 [report.json]
Uses only Python's standard library. No browser, account or paid API required.
"""
import json
import os
import re
import subprocess
import sys
from html.parser import HTMLParser
from urllib.parse import urlsplit
from urllib.request import urlopen
from urllib.robotparser import RobotFileParser
from xml.etree import ElementTree

BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://127.0.0.1:3011"
SITE = "https://migosai.design"
CORE = "/hotel-lobby-ai-video-generator"
HTTP_CLIENT = os.environ.get("GEO_HTTP_CLIENT", "urllib")
assert HTTP_CLIENT in ("urllib", "curl"), "Unsupported GEO_HTTP_CLIENT"
GEO = [CORE, CORE + "-free", "/hotel-lobby-ai-template", "/hotel-lobby-ai-filter",
       "/hotel-lobby-ai-generator", "/blog/best-hotel-lobby-ai-video-generators-2026"]


def normalize(text):
    return re.sub(r"\s+", " ", text).strip()


def assert_paid_credit_copy(text, label):
    text = normalize(text)
    assert not re.search(r"\b[1-9]\d*(?:[\s-]+welcome[\s-]+credits?|[\s-]+credit[\s-]+welcome[\s-]+grant)\b", text, re.I), (label, "Signup-credit promotion is no longer offered")
    assert re.search(r"\b(?:paid|purchase|buy)\b[^.!?]{0,160}\bcredits?(?:\s+packs?)?\b", text, re.I), (label, "Missing paid-credit requirement")


class Page(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.headings = {"h1": [], "h2": []}
        self.title = []
        self.canonical = []
        self.description = []
        self.robots = []
        self.alternates = {}
        self.ids = set()
        self.links = []
        self.images = []
        self.showcase_items = 0
        self.jsonld = []
        self.faqs = []
        self.visible = []
        self.capture = None
        self.buffer = []
        self.hidden = None
        self.script = []
        self.is_jsonld = False
        self.faq = None
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get("id"):
            self.ids.add(a["id"])
        if tag in ("script", "style"):
            self.hidden = tag
            self.is_jsonld = tag == "script" and a.get("type") == "application/ld+json"
            self.script = []
        if tag == "link" and a.get("rel") == "canonical":
            self.canonical.append(a.get("href"))
        if tag == "link" and a.get("rel") == "alternate" and a.get("hreflang"):
            self.alternates[a["hreflang"]] = a.get("href")
        if tag == "meta" and a.get("name") in ("description", "robots"):
            getattr(self, a["name"]).append(a.get("content", ""))
        if tag == "a" and a.get("href"):
            self.links.append(a["href"])
        if tag == "img" and a.get("src", "").startswith("/"):
            self.images.append(a["src"])
        if tag == "div" and "geo-showcase-item" in a.get("class", "").split():
            self.showcase_items += 1
        if tag == "article" and "faq-item" in a.get("class", "").split():
            self.faq = {}
        if tag in ("h1", "h2", "title") or (self.faq is not None and tag in ("h3", "p")):
            self.capture, self.buffer = tag, []

    def handle_data(self, data):
        if self.hidden:
            if self.is_jsonld:
                self.script.append(data)
            return
        self.visible.append(data)
        if self.capture:
            self.buffer.append(data)

    def handle_endtag(self, tag):
        if tag == self.hidden:
            if self.is_jsonld:
                self.jsonld.append(json.loads("".join(self.script)))
            self.hidden, self.is_jsonld = None, False
        if tag == self.capture:
            value = normalize("".join(self.buffer))
            if tag in self.headings:
                self.headings[tag].append(value)
            elif tag == "title":
                self.title.append(value)
            elif self.faq is not None:
                self.faq[tag] = value
            self.capture = None
        if tag == "article" and self.faq is not None:
            self.faqs.append(self.faq)
            self.faq = None


cache = {}


def fetch(path):
    if path not in cache:
        if HTTP_CLIENT == "curl":
            result = subprocess.run(["curl", "--silent", "--show-error", "--fail",
                                     "--compressed", "--retry", "2", "--max-time", "30",
                                     "--write-out", "\n%{http_code}", BASE + path],
                                    check=True, capture_output=True)
            body, status = result.stdout.rsplit(b"\n", 1)
            assert status == b"200", (path, status.decode())
            cache[path] = body
        else:
            with urlopen(BASE + path, timeout=90) as response:
                assert response.status == 200, (path, response.status)
                cache[path] = response.read()
    return cache[path]


xml = ElementTree.fromstring(fetch("/sitemap.xml"))
locations = [el.text for el in xml.findall("{*}url/{*}loc")]
assert len(locations) == len(set(locations)), "Duplicate sitemap URLs"
assert all(url.startswith(SITE + "/") for url in locations), "Unexpected sitemap origin"
paths = [urlsplit(url).path or "/" for url in locations]
assert set(GEO) <= set(paths), "Missing GEO sitemap routes"
locale_prefixes = [""] + ["/" + locale for locale in ("ko", "ja", "fr", "es", "zh-TW") if "/" + locale + CORE in paths]
english_geo = list(GEO)
GEO = [prefix + path for prefix in locale_prefixes for path in english_geo]
assert set(GEO) <= set(paths), "Incomplete localized GEO routes"
assert not any(re.match(r"^/(?:ko/|ja/|fr/|es/|zh-TW/)?(?:api/|app/|sign-)", path) for path in paths)
pages = {path: Page(fetch(path).decode()) for path in paths}
rows = []
for path in GEO:
    page = pages[path]
    assert len(page.headings["h1"]) == 1, (path, "Expected one SSR H1")
    assert len(page.headings["h2"]) >= 2, (path, "Missing SSR sections")
    assert len(page.title) == 1 and "2026" in page.title[0], (path, "Missing dated title")
    assert len(page.description) == 1 and page.description[0], (path, "Missing description")
    assert page.canonical == [SITE + path], (path, "Canonical mismatch", page.canonical)
    assert not any("noindex" in value for value in page.robots), (path, "noindex")
    assert len(normalize(" ".join(page.visible))) > 1000, (path, "Missing visible copy")
    prefix = next((p for p in locale_prefixes if p and path.startswith(p + "/")), "")
    for destination in ("/", "/showcases", "/pricing"):
        target = prefix + (destination if destination != "/" or not prefix else "")
        assert target in page.links, (path, "Missing return link", target)
    if len(locale_prefixes) > 1:
        base_path = path[len(prefix):]
        for language_prefix in locale_prefixes:
            assert page.alternates.get(language_prefix.lstrip("/") or "en") == SITE + language_prefix + base_path, (path, "hreflang mismatch")
    rows.append({"path": path, "status": 200, "h1": page.headings["h1"][0],
                 "canonical": page.canonical[0], "jsonld_blocks": len(page.jsonld)})

core = pages[CORE]
graph = core.jsonld[0]["@graph"]
assert {node["@type"] for node in graph} >= {"SoftwareApplication", "FAQPage", "BreadcrumbList"}
application = next(node for node in graph if node["@type"] == "SoftwareApplication")
assert "offers" not in application, "Unverified free-price offer"
assert application.get("isAccessibleForFree") is not True, "Free-generation flag conflicts with paid-credit policy"
assert_paid_credit_copy(" ".join(core.visible), "Core page")
assert_paid_credit_copy(application["description"], "SoftwareApplication description")
faq = next(node for node in graph if node["@type"] == "FAQPage")
expected = [(normalize(node["name"]), normalize(node["acceptedAnswer"]["text"])) for node in faq["mainEntity"]]
visible = [(item["h3"], item["p"]) for item in core.faqs]
assert len(visible) == 8 and visible == expected, "FAQ schema must match visible FAQ exactly"
assert visible[0][1].startswith("No."), "Free-generation FAQ must explain the paid-credit requirement"
faq_matches = len(visible)
for prefix in locale_prefixes:
    localized_core = pages[prefix + CORE]
    for path in english_geo:
        assert prefix + path in pages[prefix or "/"].links, (prefix + path, "Missing footer link")
        if path != CORE:
            assert prefix + path in localized_core.links, (prefix + path, "Missing core page link")
    showcase = pages[prefix + "/showcases"]
    assert showcase.showcase_items > 0, (prefix, "Missing first-party showcase cards")
    assert showcase.links.count(prefix + CORE) >= showcase.showcase_items + 1, (prefix, "Each first-party showcase and the footer must link to the generator")
    if prefix:
        localized_graph = localized_core.jsonld[0]["@graph"]
        localized_faq = next(node for node in localized_graph if node["@type"] == "FAQPage")
        localized_expected = [(normalize(node["name"]), normalize(node["acceptedAnswer"]["text"])) for node in localized_faq["mainEntity"]]
        localized_visible = [(item["h3"], item["p"]) for item in localized_core.faqs]
        assert len(localized_visible) == 8 and localized_visible == localized_expected, (prefix, "Localized FAQ/schema mismatch")
        localized_app = next(node for node in localized_graph if node["@type"] == "SoftwareApplication")
        assert localized_app["url"] == SITE + prefix + CORE, (prefix, "Schema URL mismatch")
        assert localized_app.get("isAccessibleForFree") is not True, (prefix, "Free-generation flag conflicts with paid-credit policy")
        faq_matches += len(localized_visible)

for path, page in pages.items():
    for link in page.links:
        if link.startswith("/") or link.startswith("#"):
            parts = urlsplit(link)
            destination = parts.path or path
            if destination in pages and parts.fragment:
                assert parts.fragment in pages[destination].ids, (path, "Broken anchor", link)
            elif destination not in pages and not re.match(r"^/(?:ko/|ja/|fr/|es/|zh-TW/)?(?:app/|api/)", destination):
                fetch(destination)
    for image in page.images:
        fetch(image)

llms = fetch("/llms.txt").decode()
assert llms.startswith("# LobbyDuo")
assert_paid_credit_copy(llms, "llms.txt")
for path in english_geo:
    assert SITE + path in llms, (path, "Missing llms.txt entry")
for url in re.findall(r"\]\((https://migosai\.design[^)]*)\)", llms):
    assert (urlsplit(url).path or "/") in paths, ("Unknown llms.txt route", url)
robots = fetch("/robots.txt").decode()
assert "User-Agent: *" in robots and "Allow: /" in robots
assert {"Disallow: /api/", "Disallow: /app/", "Disallow: /sign-in", "Disallow: /sign-up"} <= set(robots.splitlines())
crawler_rules = RobotFileParser()
crawler_rules.parse(robots.splitlines())
for bot in ("Googlebot", "GPTBot", "OAI-SearchBot", "ClaudeBot", "PerplexityBot", "Google-Extended"):
    assert all(crawler_rules.can_fetch(bot, SITE + path) for path in paths), (bot, "A public sitemap route is blocked")
report = {"base": BASE, "result": "pass", "sitemap_routes": len(paths),
          "expected_welcome_credits": 0,
          "http_client": HTTP_CLIENT,
          "faq_exact_matches": faq_matches, "checked_resources": len(cache), "pages": rows,
          "faq_comparison": "Visible and JSON-LD text with equivalent whitespace normalized, including French non-breaking spaces.",
          "scope": "Anonymous rendered HTML, public assets, internal links, sitemap, robots and llms.txt. No paid generation or external index verification."}
if len(sys.argv) > 2:
    with open(sys.argv[2], "w") as output:
        json.dump(report, output, indent=2)
        output.write("\n")
print(json.dumps(report, indent=2))
