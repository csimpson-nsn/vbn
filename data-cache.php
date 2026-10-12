<?php
// VBN | Vermont Basketball Network | vbn.nsnsports.net | NOT a VFN file | file: data-cache.php
/**
 * data-cache.php  (Vermont Basketball Network)
 *
 * Sits between the VBN pages and the "VBN Data Hub" Google Sheet. Instead of every
 * visitor's browser fetching every published tab straight from Google, this script
 * fetches each tab itself, saves a local copy, and serves that copy, refreshing it
 * on a per-source timer (see $CACHE_SECONDS_BY_SOURCE below).
 *
 * Usage from the front end:
 *   fetch("data-cache.php?src=schedule")
 *
 * If the live pull from Google fails, it serves the last good copy instead of
 * breaking the page. A stale schedule beats a broken one.
 *
 * To check a source by hand, open it in a browser:
 *   https://vbn.nsnsports.net/data-cache.php?src=schedule
 * To force a fresh pull, delete that source's file in the data-cache folder.
 */

// Short name -> published Google Sheets CSV URL (VBN Data Hub).
// Add one line here any time a new tab needs to reach the site.
$SOURCES = [
    'schedule' => 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR124tvUPhqDU7cJ9fw2H2YQXvNP_XcH5F76KlxUwDdgJ_nv12PpyLHGeIWErXDzT3uxLoh_kxyvmmI/pub?gid=0&single=true&output=csv',
    // 'stats'  => 'PASTE the published Stats tab CSV link here, then remove the // at the start of this line',
    'roster'   => 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR124tvUPhqDU7cJ9fw2H2YQXvNP_XcH5F76KlxUwDdgJ_nv12PpyLHGeIWErXDzT3uxLoh_kxyvmmI/pub?gid=1159215250&single=true&output=csv',
    'teams'    => 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR124tvUPhqDU7cJ9fw2H2YQXvNP_XcH5F76KlxUwDdgJ_nv12PpyLHGeIWErXDzT3uxLoh_kxyvmmI/pub?gid=1570140558&single=true&output=csv',
];

// Seconds a cached copy is trusted before trying Google again. Google itself takes up to
// about 45 seconds to publish an edit, so going lower than 45 gains nothing.
$DEFAULT_CACHE_SECONDS = 90;
$CACHE_SECONDS_BY_SOURCE = [
    'schedule' => 45,   // live scores poll every 45 seconds
];

$src = isset($_GET['src']) ? $_GET['src'] : '';

if (!isset($SOURCES[$src])) {
    http_response_code(400);
    header('Content-Type: text/plain');
    echo "Unknown source '" . htmlspecialchars($src) . "'. Known sources: " . implode(', ', array_keys($SOURCES));
    exit;
}

$cacheDir = __DIR__ . '/data-cache';
if (!is_dir($cacheDir)) {
    @mkdir($cacheDir, 0755, true);
}
$cacheFile = $cacheDir . '/' . $src . '.csv';
$cacheSeconds = isset($CACHE_SECONDS_BY_SOURCE[$src]) ? $CACHE_SECONDS_BY_SOURCE[$src] : $DEFAULT_CACHE_SECONDS;

$isFresh = file_exists($cacheFile) && (time() - filemtime($cacheFile) < $cacheSeconds);

if (!$isFresh) {
    // Short timeout on purpose: if Google is slow, fall back to the saved copy fast.
    $ctx = stream_context_create(['http' => ['timeout' => 6]]);
    $fresh = @file_get_contents($SOURCES[$src], false, $ctx);

    // Only accept it if it looks like real CSV. When a tab gets unpublished, Google answers
    // with a web page instead of CSV. Without this check that page would overwrite the good copy.
    $looksLikeHtml = $fresh !== false && preg_match('/^\s*<(!doctype|html)/i', $fresh);
    if ($fresh !== false && strlen(trim($fresh)) > 0 && !$looksLikeHtml) {
        // Write to a temporary file, then swap it in, so a visitor never gets a half-written file.
        $tmp = $cacheFile . '.tmp';
        if (@file_put_contents($tmp, $fresh) !== false) {
            @rename($tmp, $cacheFile);
        }
    }
}

if (!file_exists($cacheFile)) {
    http_response_code(502);
    header('Content-Type: text/plain');
    echo "Could not load '" . htmlspecialchars($src) . "' from Google, and no saved copy exists yet. Try again in a moment.";
    exit;
}

header('Content-Type: text/csv; charset=utf-8');
// Freshness is decided here on the server, not by the visitor's browser.
header('Cache-Control: no-cache');
readfile($cacheFile);
