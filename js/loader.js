function loader(seconds, callback) {
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = "flex";

    setTimeout(() => {
        overlay.style.display = "none";
        if (callback) callback();
    }, seconds * 1000);
}