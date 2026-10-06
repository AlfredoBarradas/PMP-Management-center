(() => {

    fetch("/components/topbar/topbar.html")
        .then(response => response.text())
        .then(data => {

            document
                .getElementById("topbar-container")
                .innerHTML = data;

            const pageName = document.body.dataset.page;

            document.getElementById("page-title").textContent = pageName;

    });

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/components/topbar/topbar.css";
    document.head.appendChild(link);

})();