// Global state variables
let currentScore = 0;
let currentQuestion = 1;  // Unified question counter for both live and chart updates
let scoreHistory = [];
let currentEpisodeData = [];
let undoStack = []; // For undo functionality
let currentEpisodeQuestions = 0; 
let starterUsedThisQuestion = false;
let bonusCountThisQuestion = 0;
let startersHeard = 0;
let startersCorrect = 0;
let bonusesHeard = 0;
let bonusesCorrect = 0;
let analysisChartMode = 'ppq'; // 'ppq' or 'score'

// Utility function to update the UI elements (score, question, and PPQ)
function updateUI() {
  document.getElementById("current-score").textContent = currentScore;
  document.getElementById("current-question").textContent = currentQuestion;
  const ppq = currentQuestion > 0 ? currentScore / currentQuestion : 0;
  document.getElementById("points-per-question").textContent = ppq.toFixed(2);
  document.getElementById("starter-stats").textContent = `${startersCorrect}/${startersHeard}`;
  document.getElementById("bonus-stats").textContent = `${bonusesCorrect}/${bonusesHeard}`;
}

// Load previous theme
function loadThemeFromStorage() {
  const savedTheme = localStorage.getItem("selectedTheme");

  if (savedTheme && themes.includes(savedTheme)) {
    currentThemeIndex = themes.indexOf(savedTheme);
    const body = document.body;
    body.classList.add(savedTheme);

    document.querySelectorAll('table, .filters, button, h1, h2, h3').forEach(el =>
      el.classList.add(savedTheme)
    );
  }
}

// Load score history from localStorage
function loadScoreHistory() {
  const savedHistory = localStorage.getItem("scoreHistory");
  if (savedHistory) {
    scoreHistory = JSON.parse(savedHistory).filter(ep => ep.season && ep.episode);
    renderScoreHistory();
    populateFilters();
  }
}

// Render the score history table (assumes table element has id "score-history")
function renderScoreHistory() {
  const tableBody = document.getElementById("score-history").getElementsByTagName("tbody")[0];
  tableBody.innerHTML = ""; // Clear the current table body

  scoreHistory.forEach(episode => {
    const row = document.createElement("tr");

    const lastScore = episode.score !== undefined
      ? episode.score
      : (episode.data.length > 0 ? episode.data[episode.data.length - 1].y : 0);

    const ppq = episode.ppq !== undefined
      ? episode.ppq
      : (episode.data.length > 0 ? (lastScore / episode.data.length).toFixed(2) : '0.00');

    const starters = episode.starters || '-';
    const bonuses = episode.bonuses || '-';

    row.innerHTML = `
      <td>${episode.season}</td>
      <td>${episode.episode}</td>
      <td>${episode.dateWatched}</td>
      <td>${lastScore}</td>
      <td>${ppq}</td>
      <td>${starters}</td>
      <td>${bonuses}</td>
      <td><button onclick="viewEpisodeGraph('${episode.season}', '${episode.episode}')">View Graph</button></td>
      <td><button onclick="deleteEpisode('${episode.season}', '${episode.episode}')">Delete</button></td>
    `;

    tableBody.appendChild(row);
  });
}

// Populate season and episode filters based on scoreHistory
function populateFilters() {
  const seasonFilter = document.getElementById("season-filter");
  const episodeFilter = document.getElementById("episode-filter");
  
  // Clear previous options and add a default
  seasonFilter.innerHTML = `<option value="">All Seasons</option>`;
  episodeFilter.innerHTML = `<option value="">All Episodes</option>`;
  
  const seasons = [...new Set(scoreHistory.map(item => item.season))];
  seasons.forEach(season => {
    let option = document.createElement("option");
    option.value = season;
    option.textContent = `Season ${season}`;
    seasonFilter.appendChild(option);
  });
  
  const episodes = [...new Set(scoreHistory.map(item => item.episode))];
  episodes.forEach(ep => {
    let option = document.createElement("option");
    option.value = ep;
    option.textContent = `Episode ${ep}`;
    episodeFilter.appendChild(option);
  });
}

// Add points for a question (starter or bonus)
function addPoints(type) {
  // Prevent adding points while viewing a historic episode
  if (undoStack.length > 0 && undoStack[undoStack.length - 1].type === 'viewEpisodeGraph') {
    console.log('Cannot add points to a historic episode.');
    return;
  }

  // Rule enforcement + stats tracking
  if (type === 'starter') {
    if (starterUsedThisQuestion) {
      alert("You can't answer more than one starter per question in University Challenge!");
      return;
    }
    starterUsedThisQuestion = true;
    startersCorrect++; // ✅ Track correct starter
  } else if (type === 'bonus') {
    if (bonusCountThisQuestion >= 3) {
      alert("You can’t score more than three bonus points in a question on University Challenge!");
      return;
    }
    bonusCountThisQuestion++;
    bonusesCorrect++; // ✅ Track correct bonus
  }

  const points = type === 'starter' ? 10 : 5;
  currentScore += points;

  // Update data for the chart
  if (
    currentEpisodeData.length &&
    currentEpisodeData[currentEpisodeData.length - 1].x === currentQuestion
  ) {
    currentEpisodeData[currentEpisodeData.length - 1].y += points;
  } else {
    currentEpisodeData.push({ x: currentQuestion, y: currentScore });
  }

  // Record in undo stack
  undoStack.push({
    type: 'addPoints',
    value: points,
    question: currentQuestion
  });

  updateUI();
  updateChart();
}

// Move to the next question and record the current score in the episode data
function nextQuestion() {
  currentQuestion++;
  currentEpisodeQuestions++;
  startersHeard++;
  bonusesHeard += 3; // ✅ Bonuses were read

  starterUsedThisQuestion = false;
  bonusCountThisQuestion = 0;

  currentEpisodeData.push({ x: currentQuestion, y: currentScore });

  updateChart();
  updateUI();
}

// Move to the next question if the starter when dead
function nextDeadStarter() {
  console.log("Dead Starter clicked");
  currentQuestion++;
  currentEpisodeQuestions++;
  startersHeard++; // You heard the starter, even if no one answered it

  // ✅ Reset usage flags
  starterUsedThisQuestion = false;
  bonusCountThisQuestion = 0;

  // Add the score state (unchanged) to the chart
  currentEpisodeData.push({ x: currentQuestion, y: currentScore });

  updateChart();
  updateUI();
}

// Update the live chart with the current episode data (requires Chart.js)
function updateChart() {
  const ctx = document.getElementById('score-chart').getContext('2d');
  const chartData = {
    labels: currentEpisodeData.map(item => `Q${item.x}`),
    datasets: [{
      label: 'Cumulative Score Over Time',
      data: currentEpisodeData.map(item => item.y),
      borderColor: 'rgb(75, 192, 192)',
      fill: false,
      tension: 0.1
    }]
  };
  
  if (window.myChart) {
    window.myChart.data = chartData;
    window.myChart.update();
  } else {
    window.myChart = new Chart(ctx, {
      type: 'line',
      data: chartData,
      options: {
        scales: {
          x: {
            title: { display: true, text: 'Question Number' }
          },
          y: {
            title: { display: true, text: 'Cumulative Score' }
          }
        }
      }
    });
  }
}

// Submit the score for the current episode and start a new one
function submitScore() {
  const season = document.getElementById("season-input").value;
  const episode = document.getElementById("episode-input").value;
  const dateWatched = document.getElementById("date-input").value;
  
  if (season && episode && dateWatched && currentScore !== 0) {
    const ppq = currentEpisodeQuestions > 0 ? (currentScore / currentEpisodeQuestions).toFixed(2) : "0.00";
    const episodeData = {
      season,
      episode,
      dateWatched,
      data: currentEpisodeData,
      score: currentScore,
      ppq: ppq,
      starters: `${startersCorrect}/${startersHeard}`,
      bonuses: `${bonusesCorrect}/${bonusesHeard}`
    };
    scoreHistory.push(episodeData);
    localStorage.setItem("scoreHistory", JSON.stringify(scoreHistory));
    renderScoreHistory();
    startNewEpisode();
  } else {
    alert("Please fill in all fields and ensure you scored points before submitting.");
  }
}

// Reset live game state for a new episode
function startNewEpisode() {
  currentScore = 0;
  currentQuestion = 1;
  currentEpisodePoints = 0;
  currentEpisodeQuestions = 0;
  currentEpisodeData = [];
  undoStack = [];

  // ✅ Reset stats
  startersHeard = 0;
  startersCorrect = 0;
  bonusesHeard = 0;
  bonusesCorrect = 0;
  starterUsedThisQuestion = false;
  bonusCountThisQuestion = 0;

  // Update UI
  updateUI();
  updateChart();
}

// Delete a historic episode from scoreHistory
function deleteEpisode(season, episode) {
  const confirmDelete = confirm(
    `Are you sure you want to delete Season ${season}, Episode ${episode}? This cannot be undone.`
  );

  if (!confirmDelete) {
    return; // User cancelled
  }

  // Proceed with deletion
  scoreHistory = scoreHistory.filter(
    item => String(item.season) !== String(season) || String(item.episode) !== String(episode)
  );

  localStorage.setItem("scoreHistory", JSON.stringify(scoreHistory));
  renderScoreHistory();
}

// Undo the last addPoints action
function undo() {
  if (undoStack.length === 0) {
    alert("Nothing to undo!");
    return;
  }

  const lastAction = undoStack.pop();

  if (lastAction.type === 'addPoints') {
    currentScore -= lastAction.value;

    // Find and remove or reduce the data point in the chart
    const index = currentEpisodeData.findIndex(dp => dp.x === lastAction.question);

    if (index !== -1) {
      currentEpisodeData[index].y -= lastAction.value;

      // If score at this point is now zero, remove it entirely
      if (currentEpisodeData[index].y <= 0) {
        currentEpisodeData.splice(index, 1);
      }
    }

    // Update the per-question limits if needed
    if (lastAction.value === 10) {
      starterUsedThisQuestion = false;
    } else if (lastAction.value === 5 && bonusCountThisQuestion > 0) {
      bonusCountThisQuestion--;
    }

    updateUI();
    updateChart();
  }
}

// View a historic episode's graph without modifying the current game state
function viewEpisodeGraph(season, episode) {
  const episodeData = scoreHistory.find(item =>
    String(item.season) === String(season) && String(item.episode) === String(episode)
  );
  
  if (episodeData) {
    console.log(`Viewing graph for Season: ${season}, Episode: ${episode}`);
    // Backup current game state
    const backup = {
      currentQuestion,
      currentScore,
      currentEpisodeData: [...currentEpisodeData]
    };
    
    // Set the state to the historic episode's data and update the chart
    currentEpisodeData = episodeData.data;
    currentQuestion = currentEpisodeData.length + 1;
    document.getElementById("points-per-question").textContent = '0.00';
    
    // Disable the ability to add points while viewing a historic episode
    const starterButton = document.getElementById("starter-button");
    if (starterButton) {
      starterButton.disabled = true;
    }
    
    const bonusButton = document.getElementById("bonus-button");
    if (bonusButton) {
      bonusButton.disabled = true;
    }
    
    const nextQuestionButton = document.getElementById("next-question-button");
    if (nextQuestionButton) {
      nextQuestionButton.disabled = true;
    }
    
    updateChart();
    
    // Restore the live game state
    currentQuestion = backup.currentQuestion;
    currentScore = backup.currentScore;
    currentEpisodeData = backup.currentEpisodeData;
    
    // Re-enable buttons after restoring the live game state
    if (starterButton) {
      starterButton.disabled = false;
    }
    if (bonusButton) {
      bonusButton.disabled = false;
    }
    if (nextQuestionButton) {
      nextQuestionButton.disabled = false;
    }
    
    // Clear the historic view flag so that points can be added again
    lastAction = null;
    console.log("Historic episode viewed; live state restored.");
  } else {
    console.log("No data found for this episode.");
  }
}

// Sort the score history table by a given column (ensuring table id matches "score-history")
 function sortTable(columnIndex, headerElement) {
  const table = document.getElementById("score-history");
  const tbody = table.tBodies[0];
  const rows = Array.from(tbody.rows);

  // Get the current sort order
  let order = headerElement.getAttribute("data-order") || "asc";

  // Determine the new sort order
  const isAscending = order === "asc";
  headerElement.setAttribute("data-order", isAscending ? "desc" : "asc");

  // Sort rows
  rows.sort((a, b) => {
    const cellA = a.cells[columnIndex].textContent.trim();
    const cellB = b.cells[columnIndex].textContent.trim();

    // Try to parse as number if possible, else compare as string
    const valA = isNaN(cellA) ? cellA : parseFloat(cellA);
    const valB = isNaN(cellB) ? cellB : parseFloat(cellB);

    if (valA < valB) return isAscending ? -1 : 1;
    if (valA > valB) return isAscending ? 1 : -1;
    return 0;
  });

  // Reattach sorted rows
  rows.forEach(row => tbody.appendChild(row));
}

// Filter the score history table by season or episode
function filterTable() {
  const seasonFilter = document.getElementById("season-filter").value;
  const episodeFilter = document.getElementById("episode-filter").value;
  const rows = document.getElementById("score-history").getElementsByTagName("tbody")[0].getElementsByTagName("tr");
  for (let row of rows) {
    const season = row.cells[0].textContent;
    const episode = row.cells[1].textContent;
    row.style.display = ((seasonFilter === "" || season === seasonFilter) &&
                         (episodeFilter === "" || episode === episodeFilter)) ? "" : "none";
  }
}

// Analysis
function populateAnalysisSeasonOptions() {
  const seasonSelect = document.getElementById("analysis-season-select");
  const seasons = [...new Set(scoreHistory.map(ep => ep.season))].sort();

  seasons.forEach(season => {
    const option = document.createElement("option");
    option.value = season;
    option.textContent = `Season ${season}`;
    seasonSelect.appendChild(option);
  });
}

//Render Analysis
function renderSeasonAnalysis() {
  const season = document.getElementById("analysis-season-select").value;
  const container = document.getElementById("season-analysis-results");
  container.innerHTML = ""; // Clear previous content

  // Clear chart canvas too
  const chartCanvas = document.getElementById("season-ppq-chart");
  if (chartCanvas) {
    const chartContainer = chartCanvas.parentElement;
    chartCanvas.remove(); // Remove old canvas to fully reset Chart.js
    const newCanvas = document.createElement("canvas");
    newCanvas.id = "season-ppq-chart";
    newCanvas.height = 200;
    chartContainer.appendChild(newCanvas);
  }

  if (!season) return;

  const episodes = scoreHistory.filter(ep => ep.season == season);

  if (episodes.length === 0) {
    container.textContent = "No episodes found for this season.";
    return;
  }

  // Summary stats
  const totalEpisodes = episodes.length;
  const totalScore = episodes.reduce((sum, ep) => sum + (ep.score || 0), 0);
  const totalPPQ = episodes.reduce((sum, ep) => sum + (parseFloat(ep.ppq) || 0), 0);

  const [bestEp] = [...episodes].sort((a, b) => (b.score || 0) - (a.score || 0));
  const [worstEp] = [...episodes].sort((a, b) => (a.score || 0) - (b.score || 0));

  const summary = document.createElement("div");
  summary.innerHTML = `
    <h3>📊 Season ${season} Summary</h3>
    <p><strong>Episodes:</strong> ${totalEpisodes}</p>
    <p><strong>Average Score:</strong> ${(totalScore / totalEpisodes).toFixed(1)}</p>
    <p><strong>Average PPQ:</strong> ${(totalPPQ / totalEpisodes).toFixed(2)}</p>
    <p><strong>Best Episode:</strong> Episode ${bestEp.episode} (${bestEp.score} pts)</p>
    <p><strong>Worst Episode:</strong> Episode ${worstEp.episode} (${worstEp.score} pts)</p>
  `;
  container.appendChild(summary);

  // Create table
  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr>
        <th>Episode</th>
        <th>Date</th>
        <th>Score</th>
        <th>PPQ</th>
        <th>Starters</th>
        <th>Bonuses</th>
      </tr>
    </thead>
    <tbody>
      ${episodes.map(ep => `
        <tr>
          <td>${ep.episode}</td>
          <td>${ep.dateWatched}</td>
          <td>${ep.score || 0}</td>
          <td>${ep.ppq || '0.00'}</td>
          <td>${ep.starters || '-'}</td>
          <td>${ep.bonuses || '-'}</td>
        </tr>
      `).join('')}
    </tbody>
  `;
  container.appendChild(table);

  // Draw chart
  const ctx = document.getElementById("season-ppq-chart").getContext("2d");
  const labels = episodes.map(ep => `Ep ${ep.episode}`);
  const chartLabel = analysisChartMode === 'ppq' ? 'PPQ by Episode' : 'Score by Episode';
  const chartData = analysisChartMode === 'ppq'
    ? episodes.map(ep => parseFloat(ep.ppq) || 0)
    : episodes.map(ep => parseFloat(ep.score) || 0);

  if (window.seasonChart) {
    window.seasonChart.destroy(); // Prevent chart layering
  }

  window.seasonChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: chartLabel,
        data: chartData,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.2,
        fill: true,
        pointRadius: 5
      }]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: analysisChartMode === 'ppq' ? 'Points Per Question' : 'Score'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Episode'
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });

  // Show and update the toggle only after chart has rendered
  const toggleWrapper = document.getElementById("chart-toggle-wrapper");
  const toggleText = document.getElementById("toggle-label-text");
  toggleText.textContent = analysisChartMode === 'ppq' ? "PPQ" : "Score";
  document.getElementById("chart-toggle-checkbox").checked = (analysisChartMode === 'score');
  toggleWrapper.style.display = "flex";  // Show the toggle
}

//Toggle between PPQ and score
function toggleAnalysisChart() {
  analysisChartMode = document.getElementById("chart-toggle-checkbox").checked ? 'score' : 'ppq';
  renderSeasonAnalysis();
}

// Theme cycle variables and function to toggle color schemes
let currentThemeIndex = 0;
const themes = ['peach-theme', 'grey-orange-theme', 'aquamarine-theme', 'lavender-theme', 'retro-pop-theme', 'japanese-theme'];

// Toggling the color schemes
function toggleColorScheme() {
  const body = document.body;

  // Remove current theme
  body.classList.remove(themes[currentThemeIndex]);
  document.querySelectorAll('table, .filters, button, h1, h2, h3').forEach(el =>
    el.classList.remove(themes[currentThemeIndex])
  );

  // Move to next theme
  currentThemeIndex = (currentThemeIndex + 1) % themes.length;

  // Apply new theme
  const newTheme = themes[currentThemeIndex];
  body.classList.add(newTheme);
  document.querySelectorAll('table, .filters, button, h1, h2, h3').forEach(el =>
    el.classList.add(newTheme)
  );

  // Save to localStorage
  localStorage.setItem("selectedTheme", newTheme);
}

// Load score history when the page loads
document.addEventListener("DOMContentLoaded", () => {
  loadThemeFromStorage();    // Apply saved theme
  loadScoreHistory();        // Load score table
  populateAnalysisSeasonOptions();
});


