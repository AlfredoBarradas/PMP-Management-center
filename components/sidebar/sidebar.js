(() => {

    fetch("/components/sidebar/sidebar.html")
        .then(response => response.text())
        .then(data => {

            const container = document.getElementById("sidebar-container");

            container.innerHTML = data;

            const currentPage = document.body.dataset.page;

            const activeLink = container.querySelector(
                `[data-page="${currentPage}"]`
            );

            if (activeLink) {
                activeLink.classList.add("active");
            }

        });

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/components/sidebar/sidebar.css";
    document.head.appendChild(link);

})();