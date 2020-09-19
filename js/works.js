
$(document).ready(async function() {
    w3 = new Web3(window.ethereum);

    if (await getAccount()){
        // MetaMask is connected
        await checkNetwork();
        w3 = new Web3(window.ethereum);
        logged_in = true;

        w3.eth.getBalance(acc, web3.eth.defaultBlock, (e, bal) => {
            $("#account").text(`${acc} with ${w3.utils.fromWei(bal, "ether")} ETH`);
        })
    } else {
        // Guest mode
        w3 = new Web3(new Web3.providers.WebsocketProvider("wss://ropsten.infura.io/ws/v3/31846ed5f60c42a2b438d2def2c34ab9"))
        logged_in = false;

        $("#account").text("");
        $(".guest").removeAttr("hidden");
    }

    
    contract = new w3.eth.Contract(await $.get(contractABI), contractAddress);
    // console.log(contract);
    
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

        // Get works
    const container = $("#worksContainer");
    contract.methods.workCount().call().then((count) => {
        if (count == 0) {
            $("#loadingTxt").text("No works yet :P");
            return;
        }

        const ids = [];
        for (let i = 0; i < count; i++) {
            ids.push(i);
        }
        Promise.allSettled(
            ids.map(i => contract.methods.works(i).call())
        ).then(async (res) => {
            res.forEach((promise, i) => {
                const w = promise.value;
                if (w.exists) {
                    const template = document.importNode(document.getElementById("workTemplate").content, true);
                    $("#title", template).text(w["name"]);
                    $("#desc", template).text(w["url"]);
                    $(".rateBtn", template).attr("work-id", ids[i]);
                    if (is_rater) {
                        $(".onlyRater", template).removeAttr("hidden");
                    }
                    container.append(template);
                }
            })
            $("#loading").hide();

            if (is_rater) {
                // Disable rated buttons
                const rated = await contract.methods.ratedWorks(acc).call();
                rated.forEach((id) => {
                    $(`[work-id='${id}'`).text("Rated").attr("disabled", true);
                })
            }
            
        })
    })
    
})

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
