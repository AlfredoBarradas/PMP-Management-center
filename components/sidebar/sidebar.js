(() => {

    fetch("/components/sidebar/sidebar.html")
        .then(response => response.text())
        .then(data => {

            document
                .getElementById("sidebar-container")
                .innerHTML = data;

        });

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/components/sidebar/sidebar.css";
    document.head.appendChild(link);

})();