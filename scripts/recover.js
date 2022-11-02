const hre = require("hardhat");
const fs = require("fs");
const lib = require("./trade_lib");

config = lib.config;

require("dotenv").config({ path: "../.env" });
const wallet_address = process.env.address;

const main = async () => {
  arb = await lib.getArbContract();
  const test = await arb.owner();
  const owner = await lib.getImpersonatedSigner(wallet_address);
  console.log(`Owner: ${wallet_address} contract owner ${test}`);
  for (let i = 0; i < config.baseAssets.length; i++) {
    const asset = config.baseAssets[i];
    let balance = await arb.getBalance(asset.address);
    console.log(`${asset.sym} Start Balance: `,balance.toString());
    await arb.connect(owner).recoverTokens(asset.address);
    balance = await arb.getBalance(asset.address);
    await new Promise(r => setTimeout(r, 2000));
    console.log(`${asset.sym} Close Balance: `,balance.toString());
  }
}

process.on('uncaughtException', function(err) {
	console.log('UnCaught Exception 83: ' + err);
	console.error(err.stack);
	fs.appendFile('./critical.txt', err.stack, function(){ });
});

process.on('unhandledRejection', (reason, p) => {
	console.log('Unhandled Rejection at: '+p+' - reason: '+reason);
});

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
