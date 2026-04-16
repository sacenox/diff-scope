import { Divider, Spacer } from "@cel-tui/components";
import { HStack, ProcessTerminal, Text, VStack, cel } from "@cel-tui/core";
import packageJson from "../package.json";

type GitCommandResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
};

type RepoSnapshot = {
  cwd: string;
  branch: string;
  statusSummary: string;
  diffLines: string[];
};

type RepoState = {
  snapshot: RepoSnapshot;
  fingerprint: string;
};

const APP_NAME = packageJson.name;
const APP_VERSION = packageJson.version;
const CHANGE_DETECTION_INTERVAL_MS = 5_000;
const textDecoder = new TextDecoder();

let helpOpen = false;
let displayedState = readRepoState();
let snapshot = displayedState.snapshot;
let displayedFingerprint = displayedState.fingerprint;
let hasPendingChanges = false;

function decode(buffer: Uint8Array<ArrayBufferLike>): string {
  return textDecoder.decode(buffer).replace(/\r\n/g, "\n").trimEnd();
}

function runGit(args: string[]): GitCommandResult {
  const result = Bun.spawnSync({
    cmd: ["git", ...args],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  return {
    ok: result.exitCode === 0,
    stdout: decode(result.stdout),
    stderr: decode(result.stderr),
  };
}

function shortenPath(path: string): string {
  const home = process.env.HOME;

  if (!home || !path.startsWith(home)) {
    return path;
  }

  const suffix = path.slice(home.length);
  return suffix ? `~${suffix}` : "~";
}

function summarizeStatus(shortStatus: string): string {
  if (!shortStatus) {
    return "clean";
  }

  let staged = 0;
  let modified = 0;
  let untracked = 0;

  for (const line of shortStatus.split("\n")) {
    if (!line) {
      continue;
    }

    if (line.startsWith("??")) {
      untracked += 1;
      continue;
    }

    const indexStatus = line[0] ?? " ";
    const worktreeStatus = line[1] ?? " ";

    if (indexStatus !== " ") {
      staged += 1;
    }

    if (worktreeStatus !== " ") {
      modified += 1;
    }
  }

  const parts: string[] = [];

  if (staged > 0) {
    parts.push(`staged ${staged}`);
  }

  if (modified > 0) {
    parts.push(`modified ${modified}`);
  }

  if (untracked > 0) {
    parts.push(`untracked ${untracked}`);
  }

  return parts.length > 0 ? parts.join(" · ") : "clean";
}

function readBranch(): string {
  const branch = runGit(["branch", "--show-current"]);
  const branchName = branch.stdout.trim();

  if (branch.ok && branchName) {
    return branchName;
  }

  const detachedHead = runGit(["rev-parse", "--short", "HEAD"]);
  if (detachedHead.ok && detachedHead.stdout.trim()) {
    return `(detached ${detachedHead.stdout.trim()})`;
  }

  return "(unknown branch)";
}

function buildFingerprint(parts: string[]): string {
  return parts.join("\n\0\n");
}

function buildDiffLines(
  statusSummary: string,
  stagedDiff: string,
  unstagedDiff: string,
): string[] {
  const stagedLines = stagedDiff ? stagedDiff.split("\n") : [];
  const unstagedLines = unstagedDiff ? unstagedDiff.split("\n") : [];

  if (stagedLines.length > 0 && unstagedLines.length > 0) {
    return [
      "Staged changes",
      "",
      ...stagedLines,
      "",
      "Unstaged changes",
      "",
      ...unstagedLines,
    ];
  }

  if (stagedLines.length > 0) {
    return stagedLines;
  }

  if (unstagedLines.length > 0) {
    return unstagedLines;
  }

  if (statusSummary === "clean") {
    return [
      "Working tree is clean.",
      "",
      "Edit a tracked file, then press r to refresh this snapshot.",
    ];
  }

  return [
    "No diff to show.",
    "",
    `Status: ${statusSummary}.`,
    "",
    "Tip: untracked files do not appear in git diff until they are added.",
  ];
}

function readRepoState(): RepoState {
  const cwd = shortenPath(process.cwd());
  const status = runGit(["status", "--short"]);

  if (!status.ok) {
    const snapshot = {
      cwd,
      branch: "(not a git repo)",
      statusSummary: "git status unavailable",
      diffLines: [
        "This directory is not a git repository.",
        "",
        status.stderr || "git status failed.",
      ],
    };

    return {
      snapshot,
      fingerprint: buildFingerprint([cwd, snapshot.branch, snapshot.statusSummary, status.stderr]),
    };
  }

  const branch = readBranch();
  const statusSummary = summarizeStatus(status.stdout);
  const unstaged = runGit(["diff", "--no-color"]);
  if (!unstaged.ok) {
    const snapshot = {
      cwd,
      branch,
      statusSummary,
      diffLines: ["git diff failed.", "", unstaged.stderr || "Unknown git error."],
    };

    return {
      snapshot,
      fingerprint: buildFingerprint([cwd, branch, status.stdout, unstaged.stderr]),
    };
  }

  const staged = runGit(["diff", "--cached", "--no-color"]);
  if (!staged.ok) {
    const snapshot = {
      cwd,
      branch,
      statusSummary,
      diffLines: [
        "git diff --cached failed.",
        "",
        staged.stderr || "Unknown git error.",
      ],
    };

    return {
      snapshot,
      fingerprint: buildFingerprint([cwd, branch, status.stdout, staged.stderr]),
    };
  }

  return {
    snapshot: {
      cwd,
      branch,
      statusSummary,
      diffLines: buildDiffLines(statusSummary, staged.stdout, unstaged.stdout),
    },
    fingerprint: buildFingerprint([cwd, branch, status.stdout, staged.stdout, unstaged.stdout]),
  };
}

function refreshSnapshot() {
  displayedState = readRepoState();
  snapshot = displayedState.snapshot;
  displayedFingerprint = displayedState.fingerprint;
  hasPendingChanges = false;
  cel.render();
}

function checkForPendingChanges() {
  const current = readRepoState();
  const nextHasPendingChanges = current.fingerprint !== displayedFingerprint;

  if (nextHasPendingChanges !== hasPendingChanges) {
    hasPendingChanges = nextHasPendingChanges;
    cel.render();
  }
}

function quit() {
  cel.stop();
  process.exit(0);
}

function diffLineProps(line: string) {
  if (line === "Staged changes" || line === "Unstaged changes") {
    return { bold: true, fgColor: "color05" as const };
  }

  if (line.startsWith("diff --git") || line.startsWith("--- ") || line.startsWith("+++ ")) {
    return { bold: true, fgColor: "color06" as const };
  }

  if (line.startsWith("@@")) {
    return { bold: true, fgColor: "color03" as const };
  }

  if (line.startsWith("+") && !line.startsWith("+++")) {
    return { fgColor: "color02" as const };
  }

  if (line.startsWith("-") && !line.startsWith("---")) {
    return { fgColor: "color01" as const };
  }

  if (line.startsWith("index ") || line.startsWith("Binary files ")) {
    return { fgColor: "color08" as const };
  }

  if (line.startsWith("fatal:") || line.startsWith("error:")) {
    return { fgColor: "color01" as const, bold: true };
  }

  return {};
}

function renderDiffLine(line: string) {
  return VStack({ width: "100%", padding: { x: 1 } }, [
    Text(line || " ", { wrap: "word", ...diffLineProps(line) }),
  ]);
}

function renderHelpModal() {
  return VStack(
    {
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
      onKeyPress: handleKeyPress,
    },
    [
      VStack(
        {
          padding: { x: 2, y: 1 },
          bgColor: "color07",
          fgColor: "color00",
        },
        [
          Text(`${APP_NAME} v${APP_VERSION}`, {
            bold: true,
            fgColor: "color06",
          }),
          Text(""),
          Text("Keybinds", { bold: true }),
          Text("r        refresh snapshot"),
          Text("? / esc  close help"),
          Text("ctrl+q   quit"),
          Text(""),
          Text("Mouse wheel scrolls the diff view.", {
            fgColor: "color08",
          }),
        ],
      ),
    ],
  );
}

function isHelpKey(key: string) {
  return key === "?" || key === "shift+/";
}

function handleKeyPress(key: string) {
  if (key === "ctrl+q" || key === "ctrl+c") {
    quit();
    return;
  }

  if (helpOpen && (isHelpKey(key) || key === "escape")) {
    helpOpen = false;
    cel.render();
    return;
  }

  if (isHelpKey(key)) {
    helpOpen = true;
    cel.render();
    return;
  }

  if (key === "r") {
    refreshSnapshot();
  }
}

setInterval(checkForPendingChanges, CHANGE_DETECTION_INTERVAL_MS);

cel.init(new ProcessTerminal());
cel.viewport(() => {
  const baseLayer = VStack(
    {
      height: "100%",
      onKeyPress: handleKeyPress,
    },
    [
      VStack(
        {
          flex: 1,
          overflow: "scroll",
          scrollbar: true,
        },
        snapshot.diffLines.map(renderDiffLine),
      ),
      Divider({ fgColor: "color08" }),
      HStack(
        {
          padding: { x: 1 },
          bgColor: "color07",
          fgColor: "color00",
        },
        [
          Text(`${snapshot.cwd} · ${snapshot.branch} · ${snapshot.statusSummary}`),
          Spacer(),
          ...(hasPendingChanges
            ? [
                Text("new changes pending", {
                  bold: true,
                  fgColor: "color01",
                }),
                Text(" · "),
              ]
            : []),
          Text("r refresh · ? help · ctrl+q quit"),
        ],
      ),
    ],
  );

  return helpOpen ? [baseLayer, renderHelpModal()] : baseLayer;
});
