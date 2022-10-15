const hre = require("hardhat");
const fs = require("fs");
const helpers = require("@nomicfoundation/hardhat-network-helpers");

require("dotenv").config();
require("dotenv").config({ path: "../.env" });

const wallet_address = process.env.address;

const { DAI, DAI_WHALE, POOL_ADDRESS_PROVIDER } = require("../config");

const lib = require("./trade_lib");

let config,arb,owner,inTrade,balances, routers, all;

config = lib.config

const searchForRoutes = () => {
  const targetRoute = {};
  targetRoute.router1 = config.routers[Math.floor(Math.random()*config.routers.length)].address;
  targetRoute.router2 = config.routers[Math.floor(Math.random()*config.routers.length)].address;
  targetRoute.token1 = config.baseAssets[Math.floor(Math.random()*config.baseAssets.length)].address;
  targetRoute.token2 = config.tokens[Math.floor(Math.random()*config.tokens.length)].address;
  return targetRoute;
}


let goodCount = 0;
const useGoodRoutes = () => {
  const targetRoute = {};
  const route = config.routes[goodCount];
  goodCount += 1;
  if (goodCount >= config.routes.length) goodCount = 0;
  targetRoute.router1 = route[0];
  targetRoute.router2 = route[1];
  targetRoute.token1 = route[2];
  targetRoute.token2 = route[3];
  return targetRoute;
}

const lookForDualTrade = async () => {
  let targetRoute;
  if (false) {
    targetRoute = useGoodRoutes();
  } else {
    targetRoute = searchForRoutes();
  }
  await processRoute(targetRoute);
}



const dualTrade = async (router1,router2,baseToken,token2,amount) => {
  if (inTrade === true) {
    await lookForDualTrade();	
    return false;
  }
  try {
    inTrade = true;
    console.log('> Making dualTrade...');
    const tx = await arb.connect(owner).dualDexTrade(router1, router2, baseToken, token2, amount); //{ gasPrice: 1000000000003, gasLimit: 500000 }
    await tx.wait();
    inTrade = false;
    await lookForDualTrade();
  } catch (e) {
    console.log(e);
    inTrade = false;
    await lookForDualTrade();
  }
}

const setup = async () => {

  await lib.initBalances();

  setTimeout(() => {
    setInterval(() => {
      logResults();
    }, 600000);
    logResults();
  }, 120000);
}

const logResults = async () => {
  console.log(`############# LOGS #############`);
	arb = await lib.getArbContract();
  for (let i = 0; i < config.baseAssets.length; i++) {
    const asset = config.baseAssets[i];
    const assetToken = await lib.getToken(asset.address);
    balances[asset.address].balance = await assetToken.balanceOf(config.arbContract);
    const startBalance = balances[asset.address].startBalance;
    if (startBalance.toString() == '0') {
      continue;
    }
    console.log(`#  ${asset.sym}`);
    const diff = balances[asset.address].balance.sub(balances[asset.address].startBalance);
    const basisPoints = diff.mul(10000).div(balances[asset.address].startBalance);
    console.log(`#  ${asset.sym}: ${basisPoints.toString()}bps`);
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



const main = async () => {
  await setup();
  // Scale when using own node
  //[0,0,0,0,0,0,0,0,0].forEach(async (v,i) => {
  //  await new Promise(r => setTimeout(r, i*1000));
  //  await lookForDualTrade();
  //});
  const routes = lib.searchAllRoutes();
  console.log(`Loaded ${routes.length} routes`);
  for (let i = 0; i < routes.length; i++) {
    const r = routes[i];
    //console.log(r);
    await lib.processRoute(r);
  }
  logResults();
  //await lookForDualTrade();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
