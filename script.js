```javascript
const $ = id => document.getElementById(id);

let teams = [];
let match = {};
let innings = null;
let inningsNumber = 1;
let firstInnings = null;
let undoStack = [];

function showSection(id) {
    document.querySelectorAll("main > section").forEach(section => {
        section.classList.add("hidden");
    });
    $(id).classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

$("profileForm").addEventListener("submit", function (event) {
    event.preventDefault();

    const profile = {
        name: $("playerName").value.trim(),
        phone: $("phone").value.trim(),
        age: Number($("age").value),
        city: $("city").value.trim(),
        state: $("state").value.trim(),
        role: $("role").value,
        battingStyle: $("battingStyle").value,
        bowlingType: $("bowlingType").value,
        disability: $("disability").value,
        disabilityDetails: $("disabilityDetails").value.trim(),
        description: $("cricketDescription").value.trim()
    };

    if (!profile.name || !profile.phone || !profile.city || !profile.state) {
        alert("Please complete the required fields.");
        return;
    }

    localStorage.setItem("cricSmashProfile", JSON.stringify(profile));
    showSection("teamSection");
});

function getPlayers(text) {
    return text.split("\n")
        .map(name => name.trim())
        .filter(Boolean);
}

function saveTeams() {
    const name1 = $("team1Name").value.trim();
    const name2 = $("team2Name").value.trim();
    const players1 = getPlayers($("team1Players").value);
    const players2 = getPlayers($("team2Players").value);

    if (!name1 || !name2 || name1 === name2) {
        alert("Enter two different team names.");
        return;
    }

    if (players1.length < 2 || players2.length < 2) {
        alert("Enter at least 2 players for each team.");
        return;
    }

    if (players1.length > 12 || players2.length > 12) {
        alert("Each team can have a maximum of 12 players.");
        return;
    }

    teams = [
        { name: name1, players: players1 },
        { name: name2, players: players2 }
    ];

    showSection("setupSection");
}

function setupToss() {
    const overs = Number($("overs").value);

    if (!Number.isInteger(overs) || overs < 1 || overs > 50) {
        alert("Overs must be between 1 and 50.");
        return;
    }

    match.overs = overs;
    match.ground = $("ground").value.trim() || "Local Ground";
    match.ballType = $("ballType").value;

    $("tossWinner").innerHTML = teams.map((team, index) =>
        `<option value="${index}">${escapeHTML(team.name)}</option>`
    ).join("");

    $("tossMessage").textContent = "Flip the coin to begin!";
    $("tossChoices").classList.add("hidden");
    showSection("tossSection");
}

function flipCoin() {
    const result = Math.random() < 0.5 ? "HEADS" : "TAILS";
    $("tossMessage").textContent = "🪙 " + result + "! Choose the toss winner and decision.";
    $("tossChoices").classList.remove("hidden");
}

function startMatch() {
    const winnerIndex = Number($("tossWinner").value);
    const decision = $("tossDecision").value;

    const battingIndex = decision === "bat" ? winnerIndex : 1 - winnerIndex;
    match.firstBatting = battingIndex;
    match.secondBatting = 1 - battingIndex;
    match.winnerOfToss = winnerIndex;

    inningsNumber = 1;
    firstInnings = null;
    beginInnings(battingIndex, 0);
}

function beginInnings(battingIndex, target) {
    const battingTeam = teams[battingIndex];
    const bowlingTeam = teams[1 - battingIndex];

    innings = {
        battingIndex,
        bowlingIndex: 1 - battingIndex,
        battingTeam: battingTeam.name,
        bowlingTeam: bowlingTeam.name,
        players: battingTeam.players.map(name => ({
            name,
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
            out: false
        })),
        bowlers: bowlingTeam.players.map(name => ({
            name,
            balls: 0,
            runs: 0,
            wickets: 0
        })),
        striker: 0,
        nonStriker: 1,
        bowler: 0,
        total: 0,
        wickets: 0,
        legalBalls: 0,
        extras: { wide: 0, noball: 0, bye: 0, legbye: 0, penalty: 0 },
        target,
        complete: false,
        history: []
    };

    undoStack = [];
    showSection("liveSection");
    render();
}

function currentBatter() {
    return innings.players[innings.striker];
}

function currentNonStriker() {
    return innings.players[innings.nonStriker];
}

function currentBowler() {
    return innings.bowlers[innings.bowler];
}

function saveUndo() {
    undoStack.push(JSON.stringify(innings));
    if (undoStack.length > 30) undoStack.shift();
}

function undoLastBall() {
    if (!undoStack.length) {
        alert("Nothing to undo.");
        return;
    }

    innings = JSON.parse(undoStack.pop());
    render();
}

function scoreRuns(runs) {
    if (innings.complete) return;

    saveUndo();

    const batter = currentBatter();
    const bowler = currentBowler();

    innings.total += runs;
    batter.runs += runs;
    batter.balls++;
    bowler.runs += runs;
    bowler.balls++;
    innings.legalBalls++;

    if (runs === 4) batter.fours++;
    if (runs === 6) batter.sixes++;

    if (runs % 2 === 1) swapStrike();

    afterBall();
}

function scoreExtra(type) {
    if (innings.complete) return;

    saveUndo();

    const bowler = currentBowler();

    if (type === "wide") {
        innings.total++;
        innings.extras.wide++;
        bowler.runs++;
    } else if (type === "noball") {
        innings.total++;
        innings.extras.noball++;
        bowler.runs++;
    } else if (type === "bye") {
        innings.total++;
        innings.extras.bye++;
        bowler.balls++;
        innings.legalBalls++;
    } else if (type === "legbye") {
        innings.total++;
        innings.extras.legbye++;
        bowler.balls++;
        innings.legalBalls++;
    } else if (type === "penalty") {
        innings.total += 5;
        innings.extras.penalty += 5;
    }

    afterBall();
}

function recordWicket() {
    if (innings.complete) return;

    if (innings.wickets >= innings.players.length - 1) {
        alert("All out!");
        endInnings();
        return;
    }

    const available = innings.players
        .map((player, index) => ({ player, index }))
        .filter(item =>
            !item.player.out &&
            item.index !== innings.striker &&
            item.index !== innings.nonStriker
        );

    if (!available.length) {
        alert("No batter available.");
        return;
    }

    const selected = prompt(
        "Who is out?\n1. " + currentBatter().name +
        "\n2. " + currentNonStriker().name +
        "\nEnter 1 or 2:"
    );

    if (selected !== "1" && selected !== "2") return;

    saveUndo();

    const outIndex = selected === "1" ? innings.striker : innings.nonStriker;
    const outBatter = innings.players[outIndex];

    outBatter.out = true;
    outBatter.balls++;
    innings.wickets++;
    innings.legalBalls++;
    currentBowler().balls++;
    currentBowler().wickets++;

    const incomingNames = available.map((item, i) =>
        `${i + 1}. ${item.player.name}`
    ).join("\n");

    const incomingChoice = prompt(
        "Select incoming batter:\n" + incomingNames
    );

    let incomingIndex = Number(incomingChoice) - 1;

    if (!Number.isInteger(incomingIndex) ||
        incomingIndex < 0 ||
        incomingIndex >= available.length) {
        incomingIndex = 0;
    }

    const newBatterIndex = available[incomingIndex].index;

    if (selected === "1") {
        innings.striker = newBatterIndex;
    } else {
        innings.nonStriker = newBatterIndex;
    }

    afterBall();
}

function swapStrike() {
    const temp = innings.striker;
    innings.striker = innings.nonStriker;
    innings.nonStriker = temp;
}

function afterBall() {
    if (innings.legalBalls > 0 && innings.legalBalls % 6 === 0) {
        swapStrike();

        const otherBowlers = innings.bowlers
            .map((bowler, index) => ({ bowler, index }))
            .filter(item => item.index !== innings.bowler);

        if (otherBowlers.length) {
            const choice = prompt(
                "Over complete! Choose next bowler:\n" +
                otherBowlers.map((item, i) =>
                    `${i + 1}. ${item.bowler.name}`
                ).join("\n")
            );

            const number = Number(choice) - 1;

            if (Number.isInteger(number) &&
                number >= 0 &&
                number < otherBowlers.length) {
                innings.bowler = otherBowlers[number].index;
            } else {
                innings.bowler = otherBowlers[0].index;
            }
        }
    }

    const oversLimit = innings.legalBalls >= match.overs * 6;
    const allOut = innings.wickets >= innings.players.length - 1;
    const targetReached = innings.target > 0 &&
        innings.total >= innings.target;

    render();

    if (oversLimit || allOut || targetReached) {
        innings.complete = true;
        setTimeout(() => endInnings(), 150);
    }
}

function render() {
    $("inningsLabel").textContent =
        inningsNumber === 1 ? "FIRST INNINGS" : "SECOND INNINGS";

    $("battingTeamLabel").textContent = innings.battingTeam;
    $("scoreDisplay").textContent = `${innings.total}/${innings.wickets}`;

    const overs = Math.floor(innings.legalBalls / 6);
    const balls = innings.legalBalls % 6;

    $("oversDisplay").textContent =
        `${overs}.${balls} Overs / ${match.overs} Overs`;

    $("targetDisplay").textContent = innings.target
        ? `Target: ${innings.target} | Need ${Math.max(0, innings.target - innings.total)} runs`
        : "";

    $("currentPlayers").textContent =
        `🏏 ${currentBatter().name}* & ${currentNonStriker().name} | 🎯 ${currentBowler().name}`;

    $("batterTable").innerHTML = innings.players.map((player, index) => {
        const sr = player.balls
            ? (player.runs / player.balls * 100).toFixed(2)
            : "0.00";

        let status = player.out ? "Out" : "Not out";
        if (index === innings.striker) status += " *";

        return `<tr>
            <td>${escapeHTML(player.name)}<br><small>${status}</small></td>
            <td>${player.runs}</td>
            <td>${player.balls}</td>
            <td>${player.fours}</td>
            <td>${player.sixes}</td>
            <td>${sr}</td>
        </tr>`;
    }).join("");

    $("bowlerTable").innerHTML = innings.bowlers.map(bowler => {
        const ov = Math.floor(bowler.balls / 6);
        const bl = bowler.balls % 6;

        return `<tr>
            <td>${escapeHTML(bowler.name)}</td>
            <td>${ov}.${bl}</td>
            <td>${bowler.runs}</td>
            <td>${bowler.wickets}</td>
        </tr>`;
    }).join("");
}

function endInnings() {
    if (!innings) return;

    innings.complete = true;

    if (inningsNumber === 1) {
        firstInnings = JSON.parse(JSON.stringify(innings));

        const nextTeamIndex = match.secondBatting;
        inningsNumber = 2;

        alert(
            `${firstInnings.battingTeam}: ${firstInnings.total}/${firstInnings.wickets}\n` +
            "First innings complete. Set up the second innings."
        );

        beginInnings(nextTeamIndex, firstInnings.total + 1);
        return;
    }

    showResult();
}

function showResult() {
    const second = innings;
    const first = firstInnings;

    let result;

    if (second.total >= second.target) {
        result = `${second.battingTeam} won by ${9 - second.wickets} wickets!`;
    } else if (second.total === first.total) {
        result = "Match tied!";
    } else {
        result = `${first.battingTeam} won by ${first.total - second.total} runs!`;
    }

    $("resultText").textContent = result;
    $("finalScoreText").textContent =
        `${first.battingTeam}: ${first.total}/${first.wickets} | ` +
        `${second.battingTeam}: ${second.total}/${second.wickets}`;

    const allPlayers = teams.flatMap(team => team.players);
    $("playerOfMatch").innerHTML = allPlayers.map(name =>
        `<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`
    ).join("");

    showSection("resultSection");
}

function finishMatch() {
    const saved = {
        profile: JSON.parse(localStorage.getItem("cricSmashProfile") || "{}"),
        teams,
        match,
        firstInnings,
        secondInnings: innings,
        result: $("resultText").textContent,
        playerOfMatch: $("playerOfMatch").value,
        savedAt: new Date().toISOString()
    };

    const history = JSON.parse(localStorage.getItem("cricSmashMatches") || "[]");
    history.push(saved);
    localStorage.setItem("cricSmashMatches", JSON.stringify(history));

    $("savedMessage").textContent =
        `${saved.result} Player of the Match: ${saved.playerOfMatch}`;

    showSection("savedSection");
}

function goBackToToss() {
    if (confirm("Return to toss? Current innings progress will be lost.")) {
        showSection("tossSection");
    }
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

showSection("profileSection");
```
