const hre = require("hardhat");
const fs = require("fs");
require("dotenv").config();
const lib = require("./trade_lib");

require("dotenv").config({ path: "../.env" });

let config,arb,owner;


config = lib.config;

const estimateValueByRouter = async (token, amount, router) => {
	const USDC = "0x04068DA6C83AFCFA0e13ba15A6696662335D5B75" 
	let value
	if (token == USDC) {
		value = amount
	} else {
		value = await lib.getAmountOutMin(router, token,USDC, amount)
	}
	return value
}

const estimateValue = async (token, amount) => {
	const routers = ["0xf491e7b69e4244ad4002bc14e878a34207e38c29", "0x16327e3fbdaca3bcf7e38f5af2599d2ddc33ae52", "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506"]
	
	let value = ethers.BigNumber.from(0);

	for (let i = 0; i < routers.length; i++) {
		try {
			const usd = await estimateValueByRouter(token, amount, routers[i]);
			value = usd;
			break;
		  } catch (e) {
		  }
	}
	return value;
}

const main = async () => {

	var arbValue = ethers.BigNumber.from(0);
	var ownerValue = ethers.BigNumber.from(0);

	await lib.initBalances();

	const owner = await lib.getSignerOwner();
	const wallet_address = await owner.getAddress()
	const ethBalance = await lib.getEthBalanceInUsd(wallet_address)
	console.log(`Owner: ${wallet_address} USD ${ethBalance}`);
	arb = await lib.getArbContract();
		for (let i = 0; i < config.baseAssets.length; i++) {
		const asset = config.baseAssets[i];
		console.log(`#### ${asset.sym}`);
		const tokenAsset = await lib.getToken(asset.address);
		const ownerBalance = await tokenAsset.balanceOf(wallet_address);
		const ownerBalanceUsd = await lib.getTokenBalanceInUsd(asset.address, ownerBalance);
		console.log(`Owner Balance: ${ownerBalance.toString()} USD ${ownerBalanceUsd}`);
		const arbBalance = await arb.getBalance(asset.address);
		const arbBalanceUsd = await lib.getTokenBalanceInUsd(asset.address, arbBalance.toString());
		console.log(`Arb Balance: ${arbBalance.toString()} USD ${arbBalanceUsd}}`);
		const usdValue = await estimateValue(asset.address, arbBalance);
		const usdOwnerValue = await estimateValue(asset.address, ownerBalance);
		arbValue = arbValue.add(usdValue)
		ownerValue = ownerValue.add(usdOwnerValue)
	}
	console.log(`Balance in USD: Arb:${arbValue} Owner:${ownerValue}`);
}

process.on('uncaughtException', function(err) {
	console.log('UnCaught Exception 83: ' + err);
	console.error(err.stack);
	//fs.appendFile('./critical.txt', err.stack, function(){ });
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
