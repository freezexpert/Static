
const colors = [
    "primary",
    "secondary",
    "success",
    "danger",
    "warning",
    "info",
    "light",
    "dark",
]

$(document).ready(async function() {
    w3 = new Web3(window.ethereum);

    if (await getAccount()){
        // MetaMask is connected
        await checkNetwork();
        w3 = new Web3(window.ethereum);
        w3.eth.defaultAccount = acc;
        logged_in = true;

        w3.eth.getBalance(acc, w3.eth.defaultBlock, (e, bal) => {
            $("#account").text(`${w3.utils.toChecksumAddress(acc)} with ${w3.utils.fromWei(bal, "ether")} ETH`);
        })
    } else {
        // Guest mode
        w3 = new Web3(new Web3.providers.WebsocketProvider(`wss://ropsten.infura.io/ws/v3/${infuraAPI}`))
        logged_in = false;

        $("#account").text("");
        $(".guest").removeAttr("hidden");
    }

    contract = new w3.eth.Contract(await $.get(contractABI), contractAddress);
    // console.log(contract);
    
    res = await Promise.allSettled([
        getRole(),
        getWorksData(),
        getRated(),
        getCategories()
    ]);

    role = res[0].value;
    works = res[1].value;
    rated = res[2].value;
    categories = res[3].value;

    const container = $("#worksContainer");

    if (works.length == 0) {
        $("#loadingTxt").text("No works yet :P");
        return;
    }

    works.forEach((w) => {
        const template = document.importNode(document.getElementById("workTemplate").content, true);
        $("#title", template).text(w["name"]);
        $("#desc", template).text(w["url"]);
        $("#image", template).attr("src", w["sha1"]);
        $(".rateBtn", template).attr("work-id", w["id"]);

        const rate_count = w["ratings"][0].length;
        $("#rating", template).text(rate_count? w["rating"]: ":(").append(`<br><h6 class="text-muted">${rate_count? rate_count: "No"} Rating${rate_count == 1? "": "s"}</h6>`)
        
        const types_container = $("#types", template);
        for (let i = 0; i < categories.length; i++) {
            if (w["categories"] & (1 << i)) {
                types_container.append(`<span class="badge badge-pill badge-${colors[i % colors.length]}">${categories[i]}</span> `)
            }
        }

        if (role == 'rater') {
            $(".onlyRater", template).removeAttr("hidden");
        }
        container.append(template);
    })
    $("#loading").hide();

    // Disable rated buttons
    if (role == 'rater') {
        rated.forEach((id) => {
            $(`[work-id='${id}'`).text("Rated").attr("disabled", true);
        })
    }
    
})

async function getRole() {
    let role;
    if (logged_in) {
        await contract.methods.getRole().call().then((res) => {
            if (res == 2) {
                role = "admin";
                $("#role").text("Admin");
            } else if (res == 1) {
                role = "rater";
                contract.methods.raters(acc).call().then((r) => {
                    rater_points = r.points;
                    rater_disabled = r.disabled;
                    $("#role").text(`Professor ${rater_disabled? "(Disabled)": ""} with ${rater_points} points`);
                })
            } else {
                role = "student";
                $("#role").text("Student");
            }
        })
    } else {
        $("#role").text("Guest");
        role = "guest";
    }
    return role;
}

async function getWorksData() {
    const works = [];

    const count = await contract.methods.workCount().call();

    const promises = []
    for (let i = 0; i < count; i++) {
        promises.push(
            (async () => {
                let work;
                await contract.methods.works(i).call().then(async (w) => {
                    if (w.exists) {
                        ratings = await contract.methods.getRatings(i).call();
                        w["ratings"] = ratings;
                        w["rating"] = ratings[0].length? (ratings[0].reduce((a, b) => parseInt(a) + parseInt(b))) / ratings[0].length : -1;
                        w["id"] = i;
                        work = w;
                    }
                })
                return work;
            })()
        )
    }
    const res = await Promise.allSettled(promises);
    res.forEach((promise) => {
        works[promise.value.id] = promise.value;
    })
    return works;
}

async function getRated() {
    return await contract.methods.ratedWorks(acc).call();
}

async function getCategories() {
    return await contract.methods.getCategories().call();
}

$(document).on("click", ({ target }) => {
    if ($(target).hasClass("rateBtn")) {
        const id = $(target).attr("work-id")
        rate(id);
    }
})

function rate(id) {
    if (rater_disabled) {
        Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: 'Your rating privilege is disabled!'
        })
        return;
    }
    Swal.fire({
        title: 'How would you rate?',
        icon: 'question',
        input: 'range',
        inputAttributes: {
          min: 1,
          max: 10,
          step: 1
        },
        inputValue: 5,
        showLoaderOnConfirm: true,
        confirmButtonText: 'Rate!',
        showCancelButton: true,
        allowOutsideClick: () => !Swal.isLoading(),
        allowEscapeKey: () => !Swal.isLoading(),
        preConfirm: (value) => {
            $(Swal.getInput()).attr("disabled", true)
            return contract.methods.rateWork(id, value).send({
                from: acc
            })
            .once('transactionHash', (hash) => {
                $(Swal.getFooter()).html(`<div style="text-align: center;"><a>Your trasaction is being processed...</a><br><a href="https://ropsten.etherscan.io/tx/${hash}">View transaction on Etherscan</a></div>`).attr("style", "display: flex;")
            })
            .then((receipt) => {
                console.log(receipt)
                Swal.fire({
                    icon: 'success',
                    text: 'Rating sent!',
                    footer: `<a href="https://ropsten.etherscan.io/tx/${receipt.transactionHash}">View transaction on Etherscan</a>`
                }).then(() => {
                    location.reload();
                })
            })
            .catch((err) => {
                console.log(err);
                if (err.code == 4001) { // User denied
                    Swal.showValidationMessage(
                        "You canceled the transaction!"
                    )
                } else {
                    Swal.showValidationMessage(
                        "Transaction failed!!<br>View transaction on Etherscan for details"
                    )
                    Swal.fire({
                        icon: 'error',
                        text: 'Transaction failed!!',
                        footer: `<a href="https://ropsten.etherscan.io/tx/${err.transactionHash}">View on Etherscan for more details</a>`
                    })
                }
                
            })
        }
    })
}

$("#connect").on("click", async (e) => {
    if (await requestAccount()) {
        location.reload();
    }
})
