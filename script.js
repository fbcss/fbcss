// Patent pending

import Hls from "hls.js";
import moment from "moment";
import idMap from "id_map";
import transcripts from "transcripts";

const searchBar = document.getElementById("searchbar");
const contents = document.getElementById("contents");
const arrowLeft = document.getElementById("left");
const arrowRight = document.getElementById("right");
const uploadButton = document.getElementById("upload-button");
const booksButton = document.getElementById("books-button");
const sortButton = document.getElementById("sort-button");
const uploadImg = document.getElementById("upload-img");
const booksImg = document.getElementById("books-img");
const sortImg = document.getElementById("sort-img");
const uploadContent = document.getElementById("upload-content");
const booksContent = document.getElementById("books-content");
const sortContent = document.getElementById("sort-content");
const vidOverlay = document.getElementById("video-overlay");

searchBar.value = "";

uploadContent.style.height = "150px";
sortContent.style.height = "160px";

document.getElementById("start-date").value = "";
document.getElementById("end-date").value = "";

document.body.setAttribute("color-scheme", localStorage.getItem("color-scheme") || "light");

const checkComponent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check2" viewBox="0 0 16 16">
        <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0"/>
    </svg>
`;

let page = 0;
let results = [];

let testaments = {
  old: [
    "Genesis",
    "Exodus",
    "Leviticus",
    "Numbers",
    "Deuteronomy",
    "Joshua",
    "Judges",
    "Ruth",
    "1 Samuel",
    "2 Samuel",
    "1 Kings",
    "2 Kings",
    "1 Chronicles",
    "2 Chronicles",
    "Ezra",
    "Nehemiah",
    "Esther",
    "Job",
    "Psalms",
    "Proverbs",
    "Ecclesiastes",
    "Song of Solomon",
    "Isaiah",
    "Jeremiah",
    "Lamentations",
    "Ezekiel",
    "Daniel",
    "Hosea",
    "Joel",
    "Amos",
    "Obadiah",
    "Jonah",
    "Micah",
    "Nahum",
    "Habakkuk",
    "Zephaniah",
    "Haggai",
    "Zechariah",
    "Malachi",
  ],
  new: [
    "Matthew",
    "Mark",
    "Luke",
    "John",
    "Acts",
    "Romans",
    "1 Corinthians",
    "2 Corinthians",
    "Galatians",
    "Ephesians",
    "Philippians",
    "Colossians",
    "1 Thessalonians",
    "2 Thessalonians",
    "1 Timothy",
    "2 Timothy",
    "Titus",
    "Philemon",
    "Hebrews",
    "James",
    "1 Peter",
    "2 Peter",
    "1 John",
    "2 John",
    "3 John",
    "Jude",
    "Revelation",
  ],
};
const convert = (arr) => Object.fromEntries(arr.map((book) => [book, false]));
testaments = {
  "Old Testament": convert(testaments.old),
  "New Testament": convert(testaments.new),
};

let pastors = { rob: false, mark_lehew: false, greg_ryan: false, other: false };

let recentSermon = false;
let pastReferences = false;

let uploadDate = false;
let sortBy = "new";

let totalLoadedContents = 0;
let prevVideoId = "";
let searchIterations = 0;

let currLoadedSermons = [];
let currPage = 0;
let loadedAll = true;
const loadMax = 25;

// =================================================================================================
// UTILITIES
// =================================================================================================
const getCurrSunday = () => {
  const today = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  return moment(new Date(today.setDate(today.getDate() - today.getDay()))).format("YYYY-MM-DD");
};

const removeDuplicates = (originalArray) => {
  let trimmedArray = [];
  let values = [];
  let value;

  for (let i = 0; i < originalArray.length; i++) {
    value = originalArray[i]["id"];

    if (values.indexOf(value) === -1) {
      trimmedArray.push(originalArray[i]);
      values.push(value);
    }
  }

  return trimmedArray;
};

const betweenDates = (date) => {
  const startDateValue = document.getElementById("start-date").value;
  const endDateValue = document.getElementById("end-date").value;

  let startDate = null;
  let endDate = null;
  if (startDateValue !== "") startDate = new Date(startDateValue);
  if (endDateValue !== "") endDate = new Date(endDateValue);

  const isValidStartDate = startDate instanceof Date && !isNaN(startDate);
  const isValidEndDate = endDate instanceof Date && !isNaN(endDate);

  const btwStartDate = isValidStartDate ? date >= startDate : false;
  const btwEndDate = isValidEndDate ? date <= endDate : false;

  return (
    (!isValidEndDate && btwStartDate) ||
    (!isValidStartDate && btwEndDate) ||
    (btwStartDate && btwEndDate) ||
    (!isValidStartDate && !isValidEndDate)
  );
};

const fetchSermons = async (VideoID = "") => {
  try {
    await transcripts;
    let finalResult = [];
    let all = false;
    if (!pastors["rob"] && !pastors["mark_lehew"] && !pastors["greg_ryan"] && !pastors["other"])
      all = true;
    let allBooks = true;
    for (const section of Object.values(testaments)) {
      for (const book of Object.values(section)) {
        if (book) allBooks = false;
      }
    }
    if (pastors["rob"] || all) {
      for (const section of Object.values(testaments)) {
        for (const [book, value] of Object.entries(section)) {
          if (value || allBooks) finalResult = finalResult.concat(transcripts["books"][book]);
        }
      }
      if (allBooks) finalResult = finalResult.concat(transcripts["other"]);
    }
    for (const [guestType, guestVids] of Object.entries(transcripts["guests"])) {
      if ((pastors[guestType] || all) && allBooks) {
        finalResult = finalResult.concat(guestVids);
      }
    }
    if (all && allBooks) finalResult = finalResult.concat(transcripts["specials"]);
    if (VideoID !== "") finalResult = finalResult.filter((el) => el.id === VideoID);
    if (transcripts["live"]) finalResult = finalResult.concat(transcripts["live"]);
    finalResult.sort((a, b) => b.date.localeCompare(a.date));
    finalResult = finalResult.filter((el, idx) =>
      idx !== finalResult.length - 1 ? el.date !== finalResult[idx + 1].date : el.date,
    );
    if (recentSermon && keyword === "")
      finalResult = finalResult.filter((el) => el.date === getCurrSunday());
    return finalResult;
  } catch (error) {
    console.error("Error fetching or parsing JSON:", error);
  }
};

const PAGE_SIZE = 20;
let keyword = "";
let reachedEndOfSearch = false;

const loadContents = () => {
  if (Array.isArray(results)) {
    let contentsTemp = "";
    let videoDiv = "";
    let entryCount = 0;
    let enteredCount = 0;
    let replace = false;
    let replaceID = "";
    results.forEach((el) => {
      if ((sortBy === "top" && enteredCount < loadMax) || sortBy !== "top") {
        // Distance since date.
        const distanceDate = moment(el.date).fromNow();
        // User-friendly, readable date.
        const userDate = moment(el.date).format("MMM. Do, YYYY");

        if (prevVideoId !== el.id) {
          if (el.date !== getCurrSunday() && !pastReferences && recentSermon) {
            if (totalLoadedContents === 0) videoDiv += "No results found.";
            pastReferences = true;
            videoDiv += `<div id="past-references"><hr>Past references found:</div>`;
          }
          videoDiv += `<div class="video"><div class="video-date tooltip">${distanceDate}<span class="tooltiptext">${userDate}</span></div><div class="video-grid"><div class="instances">`;
        } else {
          replace = true;
          replaceID = el.id;
        }
        prevVideoId = el.id;
        el.timestamps.forEach((instance) => {
          entryCount++;
          if (
            (sortBy === "top" && entryCount > totalLoadedContents && enteredCount < loadMax) ||
            sortBy !== "top"
          ) {
            enteredCount++;
            totalLoadedContents++;
            const highlightedLine = instance[1]
              .replace(/[^a-zA-Z0-9 ]/g, "")
              .replace(new RegExp(`(${keyword})`, "gi"), `<span class="highlight">$1</span>`);
            videoDiv += `
                            <div class="snippet">
                                <div onclick="miniplayerLoad('${el.id}', '${
                                  instance[0]
                                }')" class="time" style="${
                                  instance[0].split(":").length - 1 === 1 ? "font-size: 13px;" : ""
                                }">${instance[0]}</div>
                                <div class="line">
                                    ${highlightedLine}
                                </div>
                            </div>
                        `;
          }
        });
        videoDiv += `</div><div class="bracket"></div>`;
        videoDiv += `<img onclick="miniplayerLoad('${el.id}', '00:00')" class="thumbnail" src="https://i.ytimg.com/vi/${el.id}/mqdefault.jpg"/>`;
        videoDiv += `</div></div>`;
        const emptyRep = `<div class="video"><div class="video-grid"><div class="instances"></div><div class="bracket"></div><img class="thumbnail" onclick="miniplayerLoad('${el.id}', '00:00')" src="https://i.ytimg.com/vi/${el.id}/mqdefault.jpg"/></div></div>`;
        if (videoDiv.includes(emptyRep)) videoDiv = videoDiv.replace(emptyRep, "");
      }
    });
    const offsetArr = contents.innerHTML.split(`.jpg" style="height: `);
    const offset = Number(offsetArr[offsetArr.length - 1].split("px")[0]);
    const regex = `</div><div class="bracket"></div><img onclick="miniplayerLoad\\('${replaceID}', '00:00'\\)" class="thumbnail" src="https://i.ytimg.com/vi/${replaceID}/mqdefault.jpg"${
      !matchesMobile.matches ? ` style="height: ${offset}px;"` : ``
    }></div></div>$`;
    contentsTemp += (page === 0 ? `<div id="match-count"></div>` : "") + videoDiv;
    if (results.length === 0 || enteredCount < loadMax) {
      contentsTemp += `<div id="no-results">No${
        totalLoadedContents !== 0 ? ` more` : ``
      } results found.</div>`;
      reachedEndOfSearch = true;
    }
    contents.innerHTML =
      (page !== 0
        ? replace
          ? contents.innerHTML.replace(new RegExp(regex), "")
          : contents.innerHTML
        : "") + contentsTemp;
    document.getElementById("match-count").textContent = `Showing ${totalLoadedContents} result${
      totalLoadedContents === 1 ? "" : "s"
    }.`;
    document.querySelectorAll(".snippet").forEach((el) => {
      if (el.children[1].offsetHeight > 40) el.children[1].style.padding = "10px 0";
      el.style.height = el.children[1].offsetHeight + "px";
      if (!matchesMobile.matches)
        el.parentElement.nextElementSibling.nextElementSibling.style.height =
          el.offsetHeight + "px";
    });
    scrollFunction();
  } else {
    contents.innerHTML = results;
  }
};

const loadSermons = () => {
  let sermonDiv = currPage !== 0 ? contents.innerHTML : "";
  for (
    let i = currPage * PAGE_SIZE;
    i < (currPage + 1) * PAGE_SIZE && i < currLoadedSermons.length;
    i++
  ) {
    const el = currLoadedSermons[i];
    if (!matchesMobile.matches) {
      sermonDiv += `<div class="sermon"><div class="container" onclick="miniplayerLoad('${el.id}', '00:00')"><div>${el.name}</div></div><div class="sermon-bracket"></div><img class="sermon-thumbnail" onclick="miniplayerLoad('${el.id}', '00:00')" src="https://i.ytimg.com/vi/${el.id}/mqdefault.jpg"/></div>`;
    } else {
      sermonDiv += `<div class="sermon"><div class="container" onclick="miniplayerLoad('${el.id}', '00:00')"><div>${el.name}</div><img src="https://i.ytimg.com/vi/${el.id}/mqdefault.jpg" class="mobile-thumbnail" onclick="miniplayerLoad('${el.id}', '00:00')"/></div></div>`;
    }
  }

  // Need to prevent further loading once we've reached the end.
  if ((currPage + 1) * PAGE_SIZE >= currLoadedSermons.length) {
    loadedAll = true;
    sermonDiv += `<div id="no-results">No${
      currLoadedSermons.length !== 0 ? ` more` : ``
    } results found.</div>`;
  }

  contents.innerHTML = sermonDiv;
  document.querySelectorAll(".sermon-thumbnail").forEach((el) => {
    el.style.height = 0 + "px";
  });

  // Increment current loaded page for further loading by scroll.
  currPage++;
  scrollFunction();
};

const resetSearch = () => {
  page = 0;
  contents.innerHTML = "";
  totalLoadedContents = 0;
  searchIterations = 0;
  prevVideoId = "";
  keyword = searchBar.value
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "") // Replace symbols.
    .trim();
  reachedEndOfSearch = false;
  pastReferences = false;
  search();
};

const search = async () => {
  // Reset current loaded page.
  loadedAll = false;
  currPage = 0;

  let normalSearch = false;

  // If the search bar is empty, load all sermons (Same as home page).
  if (keyword === "") {
    let sortedSermons = removeDuplicates(await fetchSermons());
    if (sortBy === "old") {
      sortedSermons.sort((a, b) => a.date.localeCompare(b.date));
    } else {
      sortedSermons.sort((a, b) => b.date.localeCompare(a.date));
    }

    currLoadedSermons = sortedSermons.filter((sermon) => {
      return betweenDates(new Date(sermon.date));
    });

    loadSermons(currLoadedSermons, currPage);
    return;
  }
  // Change to inputted color scheme
  else if (searchBar.value.startsWith('colorscheme="') && searchBar.value.endsWith('"')) {
    const colorScheme = searchBar.value.replace(/^colorscheme="|"/g, "");
    results = `<div class="match-count">Color scheme changed to ${colorScheme}.</div>`;
    document.body.setAttribute("color-scheme", colorScheme);
    localStorage.setItem("color-scheme", colorScheme);
  }
  // Soundboard
  else if (keyword === "abacabb") {
    results = `<div class="match-count">Cheat code activated.</div>`;
    document.getElementById("soundboard").click();
  }
  // Papyrus font
  else if (keyword === "fontnightmare") {
    results = `<div class="match-count">Cheat code activated.</div>`;
    document.querySelectorAll("*").forEach((el) => el.classList.add("papyrus"));
    document.querySelectorAll(".title").forEach((el) => el.classList.add("threed"));
  }
  // Yap dollar
  else if (keyword === "yapdollar") {
    results = `<div class="match-count">Cheat code activated.</div>`;
    document.getElementById("screen").style.display = "block";
    searchBar.blur();
    // Wait for the audio to be loaded and ready to play
    const funkyyap = document.getElementById("funkyyap");
    await funkyyap.load();
    await new Promise((resolve) => {
      if (funkyyap.readyState >= 4) {
        resolve();
      } else {
        funkyyap.oncanplaythrough = () => resolve();
      }
    });

    // Define the timeline for image changes
    const slideShowTimeline = [
      { time: 0, image: "assets/slideshow/1.png" },
      { time: 1.19, image: "assets/slideshow/2&11.jpg" },
      { time: 6.04, image: "assets/slideshow/3.png" },
      { time: 8, image: "assets/slideshow/4.png" },
      { time: 9.14, image: "assets/slideshow/5&10.png" },
      { time: 12.05, image: "assets/slideshow/6.png" },
      { time: 13.11, image: "assets/slideshow/7.png" },
      { time: 14.18, image: "assets/slideshow/8.png" },
      { time: 16.03, image: "assets/slideshow/9.png" },
      { time: 18.05, image: "assets/slideshow/5&10.png" },
      { time: 19.12, image: "assets/slideshow/2&11.jpg" },
    ];

    // Add timeupdate listener to sync images with audio
    funkyyap.addEventListener("timeupdate", () => {
      const currentTime = funkyyap.currentTime;

      // Find the appropriate image for the current time
      const currentSlide = slideShowTimeline.findLast((point) => currentTime >= point.time);
      if (currentSlide) {
        document.getElementById("slideshow").src = currentSlide.image;
      }
    });

    // Hide screen when audio ends
    funkyyap.addEventListener("ended", () => {
      document.getElementById("screen").style.display = "none";
    });

    // Start audio and set initial image
    await funkyyap.play();
    video.src = "";
  }
  // Normal search query
  else if (keyword !== "") {
    normalSearch = true;
    let sermons = removeDuplicates(await fetchSermons());

    let totalInstances = 0;

    if (sortBy === "new" || sortBy === "top")
      await sermons.sort((a, b) => new Date(b.date) - new Date(a.date));
    else if (sortBy === "old" && !recentSermon)
      await sermons.sort((a, b) => new Date(a.date) - new Date(b.date));

    results = [];
    let entryCount = 0;
    const kA = keyword.split(" ");
    sermons.forEach((video) => {
      const times = [];

      if (betweenDates(new Date(video.date))) {
        video.transcript.forEach((entry, idx) => {
          entryCount++;
          if (sortBy === "top" || (entryCount > searchIterations && totalInstances < loadMax)) {
            searchIterations++;
            const line = entry[1] ? entry[1].toLowerCase() : "";

            let cK = 0;
            let eT = "";
            let fL = "";
            if (line.includes(kA[0])) {
              for (let i = idx; i < video.transcript.length; i++) {
                let chooseBreak = false;
                const iteration = video.transcript[i];
                for (const word of iteration[1]
                  .toLowerCase()
                  .replace(/[^a-zA-Z0-9 ]/g, "")
                  .split(" ")) {
                  if (word === kA[cK]) {
                    cK++;
                    if (cK === 1) eT = iteration[0];
                    if (cK === kA.length) {
                      fL += iteration[1];
                      times.push([eT, fL]);
                      totalInstances++;
                      chooseBreak = true;
                      break;
                    }
                  } else if (cK !== 0 && word !== "") {
                    cK = 0;
                    if (kA[cK] === word) cK++;
                  }
                  if (cK === 0 && word === "") {
                    chooseBreak = true;
                    break;
                  } else if (word === "" && cK !== 0) {
                    fL += iteration[1];
                  }
                }
                if (chooseBreak) break;
              }
            }
          }
        });
      }

      if (times.length > 0) {
        results.push({
          id: video.id,
          title: video.name,
          date: video.date,
          timestamps: times,
        });
      }
    });
  }

  if (sortBy === "top" && normalSearch && !recentSermon)
    results.sort((a, b) => b.timestamps.length - a.timestamps.length);
  loadContents();
};

// =================================================================================================
// Load initial sermon data.
// =================================================================================================
try {
  contents.innerHTML = `<div id="match-count">Loading sermons...</div>`;

  const oldTestament = Object.keys(testaments["Old Testament"]);
  const newTestament = Object.keys(testaments["New Testament"]);
  const orderedBooks = [...oldTestament, ...newTestament];
  for (let book of orderedBooks) {
    if (!transcripts["books"].hasOwnProperty(book)) continue;

    const bookEl = document.createElement("div");
    bookEl.className = "book";
    bookEl.id = book.toLowerCase().replace(" ", "");
    bookEl.addEventListener("click", () => {
      toggleBook(book);
      bookEl.classList.toggle("checked");
    });
    bookEl.textContent = book;

    const booksContainer = document.querySelector("#books-content");
    let testament = testaments["Old Testament"].hasOwnProperty(book)
      ? "Old Testament"
      : "New Testament";
    if (testament === "Old Testament") {
      booksContainer.insertBefore(bookEl, booksContainer.querySelector("hr"));
    } else {
      booksContainer.appendChild(bookEl);
    }
  }
  for (const section of Object.values(testaments)) {
    for (const book of Object.keys(section)) {
      if (!transcripts["books"].hasOwnProperty(book)) {
        delete section[book];
      }
    }
  }
  booksContent.style.height = String(85 + Object.keys(transcripts["books"]).length * 20) + "px";
  resetSearch();
} catch (err) {
  console.error(err);
}

const togglePastor = (pastor) => {
  const el = document.getElementById(pastor);
  const buttonEl = document.getElementById(`${pastor}-btn`);
  pastors[pastor] = !pastors[pastor];
  el.classList.toggle("checked");
  buttonEl.classList.toggle("checked");
  if (pastors[pastor]) {
    const checkedContent = pastors[pastor]
      ? (matchesMobile.matches ? " " : "") + checkComponent + (!matchesMobile.matches ? " " : "")
      : "";
    el.innerHTML = `${el.textContent}${checkedContent}`;
    buttonEl.innerHTML = `${checkedContent}${el.textContent}`;
  } else {
    el.innerHTML = `${el.textContent}`;
    buttonEl.innerHTML = `${el.textContent}`;
  }
  resetSearch();
};

searchBar.addEventListener("keydown", (e) => {
  if (e.key === "Enter") resetSearch();
});

const toggleFilterButton = (img, content, button) => {
  if (content.style.display === "none") {
    img.src = `assets/arrow-up.svg`;
    content.style.display = "block";
  } else {
    img.src = `assets/arrow-down.svg`;
    content.style.display = "none";
  }
  if (!matchesMobile.matches) content.style.width = button.offsetWidth + "px";
};

const toggleUpload = () => {
  toggleFilterButton(uploadImg, uploadContent, uploadButton);
};

const toggleBooks = () => {
  toggleFilterButton(booksImg, booksContent, booksButton);
};

const toggleSort = () => {
  toggleFilterButton(sortImg, sortContent, sortButton);
};

const togglePastors = () => {
  toggleFilterButton(
    document.getElementById("pastors-img"),
    document.getElementById("pastors-content"),
    document.getElementById("pastors-button"),
  );
};

document.getElementById("pastors-button").addEventListener("click", () => togglePastors());
for (const pastor of Object.keys(pastors)) {
  document.getElementById(pastor).addEventListener("click", () => {
    togglePastor(pastor);
  });
}

uploadButton.addEventListener("click", () => toggleUpload());
booksButton.addEventListener("click", () => toggleBooks());
sortButton.addEventListener("click", () => toggleSort());

const checkboxes = ["old", "new", "top"];

const toggleCheckbox = (e, type) => {
  if (!e.target.classList.contains("checked")) e.target.classList.add("checked");
  sortBy = type;

  // Uncheck other checkboxes
  checkboxes.forEach((checkbox) => {
    if (checkbox !== type) {
      document.getElementById(checkbox).classList.remove("checked");
    }
  });

  if (!matchesMobile.matches)
    document.getElementById("sort").textContent = type.charAt(0).toUpperCase() + type.slice(1);
  resetSearch();
};

const sortTypes = ["new", "old", "top"];
for (const sort of sortTypes) {
  document.getElementById(sort).addEventListener("click", (e) => {
    toggleCheckbox(e, sort);
  });
}

document.getElementById("search-button").addEventListener("click", resetSearch);

window.onclick = (event) => {
  if (!event.target.matches("#sort-button") && sortContent.style.display === "block") {
    toggleSort();
  }
  if (
    !event.target.matches("#upload-button") &&
    !event.target.matches("#upload-content") &&
    uploadContent.style.display === "block" &&
    !event.target.matches("#upload-content *")
  ) {
    toggleUpload();
  }
  if (
    !event.target.matches("#books-button") &&
    !event.target.matches("#books-content") &&
    booksContent.style.display === "block" &&
    !event.target.matches("#books-content *")
  ) {
    toggleBooks();
  }
  if (
    matchesMobile.matches &&
    !event.target.matches("#pastors-button") &&
    !event.target.matches("#pastors-content") &&
    document.getElementById("pastors-content").style.display === "block" &&
    !event.target.matches("#pastors-content *")
  ) {
    togglePastors();
  }
};

const displayUpload = () => {
  if (!matchesMobile.matches)
    document.getElementById("upload").textContent =
      document.getElementById("start-date").value || document.getElementById("end-date").value
        ? "Limited"
        : "Any Time";
};

const embed = document.getElementById("miniplayer");
const resizeHandle = document.getElementById("miniplayer-resize");

let isDragging = false;
let isResizing = false;
let onMiniplayer = false;
let startX, startY, initialX, initialY, initialWidth, initialHeight;

const ensureTarget = (e) => {
  if (
    e.target !== vidOverlay &&
    e.target !== document.getElementById("drag-overlay")
  ) return true;
}

const handleDragStart = (e) => {
  if (ensureTarget(e)) return;
  onMiniplayer = true;
  startX = e.clientX || e.touches[0].clientX;
  startY = e.clientY || e.touches[0].clientY;
  initialX = embed.offsetLeft;
  initialY = embed.offsetTop;
  e.target.style.cursor = "grabbing";
  e.preventDefault();
};

const handleDragMove = (e) => {
  if (onMiniplayer) {
    const dx = (e.clientX || e.touches[0].clientX) - startX;
    const dy = (e.clientY || e.touches[0].clientY) - startY;
    embed.style.left = `${initialX + dx}px`;
    embed.style.top = `${initialY + dy}px`;
    e.preventDefault();
    isDragging = true;
  }
};

const handleDragEnd = (e) => {
  if (ensureTarget(e)) return;
  onMiniplayer = false;
  if (isDragging) isDragging = false;
  e.target.style.cursor = "grab";
};

const videoElement = document.getElementById("video");

const handleResizeStart = (e) => {
  isResizing = true;
  startX = e.clientX || (e.touches && e.touches[0].clientX);
  startY = e.clientY || (e.touches && e.touches[0].clientY);
  initialWidth = embed.offsetWidth;
  initialHeight = embed.offsetHeight;
  
  e.stopPropagation();
  if (e.cancelable) e.preventDefault();
};

const handleResizeMove = (e) => {
  if (!isResizing || !videoElement) return;

  const currentX = e.clientX || (e.touches && e.touches[0].clientX);
  const currentY = e.clientY || (e.touches && e.touches[0].clientY);

  const dx = currentX - startX;
  const dy = currentY - startY;

  let targetWidth = Math.max(200, initialWidth + dx);
  let targetHeight = Math.max(150, initialHeight + dy);

  const videoRatio = videoElement.videoWidth && videoElement.videoHeight
    ? videoElement.videoWidth / videoElement.videoHeight
    : 16 / 9;

  if (Math.abs(dx) > Math.abs(dy)) {
    targetHeight = targetWidth / videoRatio;
    
    if (targetHeight < 150) {
      targetHeight = 150;
      targetWidth = targetHeight * videoRatio;
    }
  } else {
    targetWidth = targetHeight * videoRatio;
    
    if (targetWidth < 200) {
      targetWidth = 200;
      targetHeight = targetWidth / videoRatio;
    }
  }

  embed.style.width = `${targetWidth}px`;
  embed.style.height = `${targetHeight}px`;

  if (e.cancelable) e.preventDefault();
};

const handleResizeEnd = () => {
  isResizing = false;
};

// Event listeners for dragging
vidOverlay.addEventListener("mousedown", handleDragStart);
vidOverlay.addEventListener("touchstart", handleDragStart);
document.querySelector("#drag-overlay").addEventListener("mousedown", handleDragStart);
document.querySelector("#drag-overlay").addEventListener("touchstart", handleDragStart);
document.addEventListener("mousemove", handleDragMove);
document.addEventListener("touchmove", handleDragMove);
vidOverlay.addEventListener("mouseup", handleDragEnd);
vidOverlay.addEventListener("touchend", handleDragEnd);
document.querySelector("#drag-overlay").addEventListener("mouseup", handleDragEnd);
document.querySelector("#drag-overlay").addEventListener("touchend", handleDragEnd);

// Event listeners for resizing
const videoResizer = document.getElementById("video-resizer");
videoResizer.addEventListener("mousedown", handleResizeStart);
videoResizer.addEventListener("touchstart", handleResizeStart);
resizeHandle.addEventListener("mousedown", handleResizeStart);
resizeHandle.addEventListener("touchstart", handleResizeStart);
document.addEventListener("mousemove", handleResizeMove);
document.addEventListener("touchmove", handleResizeMove);
document.addEventListener("mouseup", handleResizeEnd);
document.addEventListener("touchend", handleResizeEnd);

// ── Auto-hide video overlay after 5s of inactivity ──────────────────
let _overlayHideTimer = null;

const _scheduleOverlayHide = () => {
  clearTimeout(_overlayHideTimer);
  _overlayHideTimer = setTimeout(() => {
    vidOverlay.classList.add("overlay-hidden");
  }, 3000);
};

const _cancelOverlayHide = () => {
  clearTimeout(_overlayHideTimer);
  vidOverlay.classList.remove("overlay-hidden");
};

// On hover/touch enter, show overlay and start the countdown
vidOverlay.addEventListener("mouseenter", () => {
  _cancelOverlayHide();
  _scheduleOverlayHide();
});

// Any pointer movement resets the timer
vidOverlay.addEventListener("mousemove", () => {
  _cancelOverlayHide();
  _scheduleOverlayHide();
});

// Touch activity: show and restart the countdown
vidOverlay.addEventListener("touchstart", () => {
  _cancelOverlayHide();
  _scheduleOverlayHide();
}, { passive: true, capture: true });

// When leaving (desktop), cancel the timer and let CSS :hover handle hiding
vidOverlay.addEventListener("mouseleave", () => {
  clearTimeout(_overlayHideTimer);
  vidOverlay.classList.remove("overlay-hidden");
});

const videoPlay = document.getElementById("video-play");
videoPlay.addEventListener("click", (e) => {
  e.stopPropagation();
  const video = document.getElementById("video");
  if (video.paused) {
    video.play();
    videoPlay.className = "";
  } else {
    video.pause();
    videoPlay.className = "paused";
  }
});

const customVideo = document.getElementById("video");
const backBtn = document.getElementById("back-btn");
backBtn.addEventListener("click", () => {
  customVideo.currentTime = Math.max(0, customVideo.currentTime - 5);
});
const forwardBtn = document.getElementById("forward-btn");
forwardBtn.addEventListener("click", () => {
  customVideo.currentTime = Math.min(customVideo.duration || 0, customVideo.currentTime + 5);
});

window.miniplayerLoad = async (id, timestamp) => {
  const parts = timestamp.split(":").map(Number);
  let hours = 0,
    minutes = 0,
    seconds = 0;
  if (parts.length === 3) {
    [hours, minutes, seconds] = parts;
  } else if (parts.length === 2) {
    [minutes, seconds] = parts;
  }

  const totalSeconds = hours * 3600 + minutes * 60 + seconds;

  const video = document.getElementById("video");
  // Load transcript data for this sermon
  try {
    await transcripts;
    const allSermons = Object.values(transcripts["books"] || {}).flat()
      .concat(Object.values(transcripts["guests"] || {}).flat())
      .concat(transcripts["specials"] || [])
      .concat(transcripts["other"] || []);
    const sermon = allSermons.find((s) => s.id === id);
    if (sermon && sermon.transcript && sermon.transcript.length) {
      _transcriptData = sermon.transcript;
      const tBtn = _transcriptBtn();
      if (tBtn) tBtn.style.display = "";
      _buildTranscriptPanel(_transcriptData);
    } else {
      _transcriptData = null;
      const tBtn = _transcriptBtn();
      if (tBtn) tBtn.style.display = "none";
      document.getElementById("transcript-panel").className = "hidden";
      document.getElementById("transcript-panel").innerHTML = "";
    }
  } catch (_) {
    _transcriptData = null;
  }

  if (Object.hasOwn(idMap, id) && Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource(`https://letschurch-media.b-cdn.net/${idMap[id]}/master.m3u8`);
    hls.attachMedia(video);
    video.currentTime = totalSeconds;
    video.play();
    return;
  }

  video.src = "";
  document.getElementById("yt-video").src =
    `https://www.youtube.com/embed/${id}?autoplay=1&start=${totalSeconds}`;
};

window.closeMiniplayer = () => {
  document.getElementById("video").src = "";
  document.getElementById("yt-video").src = "";
  // Reset transcript state
  document.getElementById("transcript-panel").className = "hidden";
  document.getElementById("transcript-panel").innerHTML = "";
  _transcriptData = null;
  _transcriptBtn()?.classList.remove("active");
};

const _transcriptBtn = () => document.getElementById("transcript-btn");

window.maximizeMiniplayer = () => {
  const player = document.getElementById("miniplayer");
  if (document.fullscreenElement) {
    document.exitFullscreen?.();
  } else {
    player.requestFullscreen?.() ?? player.webkitRequestFullscreen?.();
  }
};

let _progressDragging = false;

const _formatTime = (s) => {
  s = Math.floor(s || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
};

const _updateProgressUI = (video) => {
  const fill = document.getElementById("progress-bar-fill");
  const thumb = document.getElementById("progress-bar-thumb");
  const timeDisplay = document.getElementById("video-time-display");
  if (!fill || !video.duration) return;
  const pct = (video.currentTime / video.duration) * 100;
  fill.style.width = `${pct}%`;
  thumb.style.left = `${pct}%`;
  timeDisplay.textContent = `${_formatTime(video.currentTime)} / ${_formatTime(video.duration)}`;
  _syncTranscriptHighlight(video.currentTime);
};

const _seekFromEvent = (e, video) => {
  const bar = document.getElementById("progress-bar-bg");
  const rect = bar.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  video.currentTime = ratio * video.duration;
  _updateProgressUI(video);
};

(() => {
  const video = document.getElementById("video");
  const pbc = document.getElementById("progress-bar-container");

  video.addEventListener("timeupdate", () => _updateProgressUI(video));
  video.addEventListener("loadedmetadata", () => _updateProgressUI(video));

  pbc.addEventListener("mousedown", (e) => {
    e.stopPropagation();
    _progressDragging = true;
    _seekFromEvent(e, video);
  });
  pbc.addEventListener("touchstart", (e) => {
    e.stopPropagation();
    _progressDragging = true;
    _seekFromEvent(e, video);
  }, { passive: true });
  document.addEventListener("mousemove", (e) => {
    if (_progressDragging) _seekFromEvent(e, video);
  });
  document.addEventListener("touchmove", (e) => {
    if (_progressDragging) _seekFromEvent(e, video);
  }, { passive: true });
  document.addEventListener("mouseup", () => { _progressDragging = false; });
  document.addEventListener("touchend", () => { _progressDragging = false; });
})();

let initialPinchDistance = null;

vidOverlay.addEventListener("touchstart", (e) => {
  if (e.touches.length === 2) {
    // Calculate initial straight-line distance between two contact touch coordinates
    initialPinchDistance = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    initialWidth = embed.offsetWidth;
    initialHeight = embed.offsetHeight;
  }
}, { passive: true });

vidOverlay.addEventListener("touchmove", (e) => {
  if (e.touches.length === 2 && initialPinchDistance !== null) {
    const currentDistance = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    
    // Find scale coefficient factor differential
    const scaleFactor = currentDistance / initialPinchDistance;
    const targetWidth = initialWidth * scaleFactor;
    const targetHeight = initialHeight * scaleFactor;

    const videoRatio = videoElement.videoWidth && videoElement.videoHeight
      ? videoElement.videoWidth / videoElement.videoHeight
      : 16 / 9;

    if (targetWidth > 200 && targetWidth < window.innerWidth) {
      embed.style.width = `${targetWidth}px`;
      embed.style.height = `${targetWidth / videoRatio}px`;
    }
  }
}, { passive: true });

vidOverlay.addEventListener("touchend", (e) => {
  if (e.touches.length < 2) {
    initialPinchDistance = null;
  }
});

// ── Transcript panel ────────────────────────────────────────────
let _transcriptData = null; // set by miniplayerLoad

const _syncTranscriptHighlight = (currentTime) => {
  if (!_transcriptData) return;
  const panel = document.getElementById("transcript-panel");
  if (panel.style.display === "none") return;
  const lines = panel.querySelectorAll(".tp-line");
  let activeIdx = -1;
  _transcriptData.forEach(([ts], i) => {
    const secs = _tsToSecs(ts);
    if (secs <= currentTime) activeIdx = i;
  });
  lines.forEach((line, i) => {
    if (i === activeIdx) {
      if (!line.classList.contains("tp-active")) {
        panel.querySelectorAll(".tp-active").forEach((el) => el.classList.remove("tp-active"));
        line.classList.add("tp-active");
        // Auto-scroll only if user hasn't manually scrolled
        line.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  });
};

const _tsToSecs = (ts) => {
  const parts = ts.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parts[0] * 60 + (parts[1] || 0);
};

const _buildTranscriptPanel = (transcriptArr) => {
  const panel = document.getElementById("transcript-panel");
  panel.innerHTML = "";
  if (!transcriptArr || !transcriptArr.length) {
    panel.innerHTML = `<div style="padding:10px;color:gray;font-size:12px">No transcript available.</div>`;
    return;
  }
  transcriptArr.forEach(([ts, text]) => {
    const line = document.createElement("div");
    line.className = "tp-line";
    line.innerHTML = `<span class="tp-ts">${ts}</span><span class="tp-text">${text}</span>`;
    line.addEventListener("click", () => {
      const video = document.getElementById("video");
      video.currentTime = _tsToSecs(ts);
      if (video.paused) video.play();
    });
    panel.appendChild(line);
  });
};

window.toggleTranscriptPanel = (e) => {
  e.stopPropagation();
  const panel = document.getElementById("transcript-panel");
  const btn = _transcriptBtn();
  const visible = panel.className !== "hidden";
  panel.className = visible ? "hidden" : "";
  btn.classList.toggle("active", !visible);
};

let arrayOfCombinations = [];
let fontNightmare = "";
window.onkeydown = (e) => {
  if (
    e.key === "ArrowUp" &&
    (arrayOfCombinations.length === 0 || arrayOfCombinations.length === 1)
  ) {
    arrayOfCombinations.push("ArrowUp");
  } else if (
    e.key === "ArrowDown" &&
    (arrayOfCombinations.length === 2 || arrayOfCombinations.length === 3)
  ) {
    arrayOfCombinations.push("ArrowDown");
  } else if (
    e.key === "ArrowLeft" &&
    (arrayOfCombinations.length === 4 || arrayOfCombinations.length === 6)
  ) {
    arrayOfCombinations.push("ArrowLeft");
  } else if (
    e.key === "ArrowRight" &&
    (arrayOfCombinations.length === 5 || arrayOfCombinations.length === 7)
  ) {
    arrayOfCombinations.push("ArrowRight");
  } else if (e.key === "b" && arrayOfCombinations.length === 8) {
    arrayOfCombinations.push("b");
  } else if (e.key === "a" && arrayOfCombinations.length === 9) {
    arrayOfCombinations = [];
    document.body.insertAdjacentHTML(
      "beforeend",
      `<img style="border-radius: 50%; position: absolute; top: 38px; left: 38px; z-index: 1600; width: 138px; height: 138px;" src="./assets/pastorrob.png"/>`,
    );
    document.querySelector(".logo").outerHTML =
      "<img style='border-radius: 50%; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 20000;' onmouseenter='setEnlarge()' onclick='clickEnlarge()' src='./assets/pastorrob.png' class='logo' />";
    document.addEventListener("mousemove", (event) => {
      document.body.insertAdjacentHTML(
        "beforeend",
        `<img src="./assets/pastorrob.png" style="position: absolute; top: ${event.clientY}px; left: ${event.clientX}px; width: 50px; height: 50px; z-index: 1000;" />`,
      );
    });
    document.addEventListener("click", (event) => {
      document.body.insertAdjacentHTML(
        "beforeend",
        `<img src="./assets/pastorrob.png" style="position: absolute; top: ${event.clientY}px; left: ${event.clientX}px; width: 100px; height: 100px; z-index: 1500;" />`,
      );
    });
  } else {
    arrayOfCombinations = [];
  }
};

const setEnlarge = () => {
  setInterval(() => {
    document.querySelector(".logo").style.width =
      Number(document.querySelector(".logo").style.width.replace("px", "")) + 1 + "px";
    document.querySelector(".logo").style.height =
      Number(document.querySelector(".logo").style.height.replace("px", "")) + 1 + "px";
  }, 100);
};

const clickEnlarge = () => {
  setInterval(() => {
    document.querySelector(".logo").style.width =
      Number(document.querySelector(".logo").style.width.replace("px", "")) + 10 + "px";
    document.querySelector(".logo").style.height =
      Number(document.querySelector(".logo").style.height.replace("px", "")) + 10 + "px";
  }, 100);
};

const scrollFunction = () => {
  if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
    document.getElementById("scroll-to-top").style.display = "block";
  } else {
    document.getElementById("scroll-to-top").style.display = "none";
  }

  // If we reach the bottom of the page, load more sermons or contents.
  if (
    Math.round(window.scrollY + window.innerHeight) >=
    document.documentElement.scrollHeight - 20
  ) {
    if (keyword === "" && !loadedAll) {
      loadSermons();
    } else if (keyword !== "" && !reachedEndOfSearch) {
      page++;
      sortBy === "top" ? loadContents() : search();
    }
  }
};

document.addEventListener("scroll", scrollFunction);

const topFunction = () => {
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
};

document.getElementById("scroll-to-top").addEventListener("click", topFunction);

window.toggleTestament = (testament) => {
  const el = testaments[testament];
  let allTestament = true;
  for (const book of Object.values(el)) {
    if (!book) allTestament = false;
  }
  for (const book of Object.keys(el)) {
    if (allTestament) {
      el[book] = false;
      document.getElementById(book.replace(" ", "").toLowerCase()).className = "book";
    } else {
      el[book] = true;
      console.log(book);
      document.getElementById(book.replace(" ", "").toLowerCase()).className = "book checked";
    }
  }
  displayBooks();
  resetSearch();
};

const toggleBook = (bookInput) => {
  for (const section of Object.values(testaments)) {
    section[bookInput] = !section[bookInput];
  }
  displayBooks();
  resetSearch();
};

const displayBooks = () => {
  let booksText = "";
  for (const section of Object.values(testaments)) {
    for (const [book, value] of Object.entries(section)) {
      if (value) booksText += `${book}, `;
    }
  }
  booksText = booksText.slice(0, -2);
  if (booksText.includes(",")) booksText = "Limited";
  if (!matchesMobile.matches) document.getElementById("books").textContent = booksText || "All";
};

const loadFBC = () => {
  document.getElementById("fbc").click();
};

window.toggleThisSermon = () => {
  recentSermon = !recentSermon;
  document.getElementById("livestream").classList.toggle("checked");
  if (recentSermon)
    document.getElementById("livestream").innerHTML = `${checkComponent} Sunday's Sermon`;
  else document.getElementById("livestream").innerHTML = `Sunday's Sermon`;
  resetSearch();
};

// Mobile Methods.
const mobileDropdowns = (x) => {
  if (x.matches) {
    document.getElementById("upload-full").innerHTML = "Date";
    document.getElementById("books-full").innerHTML = "Book(s)";
    document.getElementById("sort-full").innerHTML = "Sort";
  } else {
    document.getElementById("upload-full").innerHTML =
      `Upload Date: <span class="value" id="upload">Any Time</span>`;
    document.getElementById("books-full").innerHTML =
      `Book(s): <span class="value" id="books">All</span>`;
    document.getElementById("sort-full").innerHTML = `Sort by: <span class="value" id="sort">${
      sortBy.charAt(0).toUpperCase() + sortBy.slice(1)
    }</span>`;
    displayBooks();
    displayUpload();
  }
};

let matchesMobile = window.matchMedia("screen and (max-width: 1135px)");
mobileDropdowns(matchesMobile);
matchesMobile.addEventListener("change", () => {
  mobileDropdowns(matchesMobile);
  resetSearch();
});