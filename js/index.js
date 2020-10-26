
if (window.ethereum) {
    (async () => {
      if (await getAccount()) {
        location.href = "./works/index.html";
      }
    })();
}

$(document).ready(() => {
    $("#connect").on("click", async (e) => {
        if (await requestAccount()) {
            location.href = "./works/index.html";
        }
    })
    
    $("#continue").on("click", (e) => {
        location.href = "./works/index.html";
    })
})



