
$(document).ready(async function() {
    if (window.ethereum) {
        w3 = new Web3(window.ethereum);

        // Connect to MetaMask
        let err = false;
        await window.ethereum.request({ method: "eth_requestAccounts"}) // ethereum.enable() is deprecated
        .then((accounts) => {
            acc = accounts[0];
        })
        .catch((e) => {
            if (e.code === 4001) {
                // EIP-1193 userRejectedRequest error
                console.log('Please connect to MetaMask!');
                $("#loadingTxt").text("Please press Connect in the MetaMask menu!")
            } else {
                console.error(e);
                $("#loadingTxt").text("MetaMask connection error!")
            }
            err = true;
        })
        if (err) return;
        // console.log(w3)
        

        // Check if connected to Ropsten network
        if (w3.eth.currentProvider.networkVersion != 3) {
            console.log("Please connect to the Ropsten Testnet!");
            $("#loadingTxt").text("Please connect to the Ropsten network!")
            return;
        }

        w3.eth.getBalance(acc, web3.eth.defaultBlock, (e, bal) => {
            $("#account").text(`${acc} with ${w3.utils.fromWei(bal, "ether")} ETH`);
        })

        // Connect to contract
        contract = new w3.eth.Contract(await $.get(contractABI), contractAddress);
        // console.log(contract);
            
        // Get role
        Promise.allSettled([
            contract.methods.is_admin(acc).call().then((res) => {
                is_admin = res;
                if (is_admin) {
                    $(".admin_only").removeAttr("hidden");
                }
            }),
            contract.methods.raterValid(acc).call().then(async (res) => {
                is_rater = res;
                if (is_rater) {
                    $(".onlyRater").removeAttr("hidden");
                    await contract.methods.raters(acc).call().then((r) => {
                        rater_points = r.points;
                        rater_disabled = r.disabled;
                    })
                }
            })
        ]).then(() => {
            if (is_admin) {
                $("#role").text("Admin");
            } else if (is_rater) {
                $("#role").text(`Professor ${rater_disabled? "(Disabled)": ""} with ${rater_points} points`);
            } else {
                $("#role").text("Student");
            }
        })

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
            
    } else {
        console.log("No web3 provider detected!");
        $("#loadingTxt").text("Please install MetaMask before using this Dapp!")
    }

    
})

$(document).on("click", ({ target }) => {
    if ($(target).hasClass("rateBtn")) {
        $(target).attr("disabled", true)
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
        inputValue: 5
    }).then((res) => {
        if (res.isConfirmed) {
            contract.methods.rateWork(id, res.value).send({
                from: acc
            }).then((receipt) => {
                console.log(receipt)
                Swal.fire({
                    icon: 'success',
                    text: 'Rating sent!',
                    footer: `<a href="https://ropsten.etherscan.io/tx/${receipt.transactionHash}">View transaction on Etherscan</a>`
                }).then(() => {
                    location.reload();
                })
            }).catch((err) => {
                console.log(err);
                if (err.code == 4001) { // User denied
                    Swal.fire({
                        icon: 'error',
                        text: 'You canceled the transaction!',
                    })
                } else {
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
