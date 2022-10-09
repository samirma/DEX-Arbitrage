const hre = require("hardhat");
const fs = require("fs");
require("dotenv").config();

let config,arb,owner,inTrade,balances, routers;

const network = hre.network.name;
if (network === 'aurora') config = require('./../config/aurora.json');
if (network === 'fantom') config = require('./../config/fantom.json');

console.log(`Loaded ${config.routes.length} routes`);

const main = async () => {
  await setup();
  // Scale when using own node
  //[0,0,0,0,0,0,0,0,0].forEach(async (v,i) => {
  //  await new Promise(r => setTimeout(r, i*1000));
  //  await lookForDualTrade();
  //});
  const routes = searchAllRoutes();

  for (let i = 0; i < routes.length; i++) {
    const r = routes[i];
    //console.log(r);
    await processRoute(r);
  }
  //await lookForDualTrade();
}

const getAmountOutMin = async (router, _tokenIn, _tokenOut, _amount) => {
  const path = [_tokenIn, _tokenOut];
  const amountOutMins = await routers[router].getAmountsOut(_amount, path);
  return amountOutMins[path.length -1];
}

const estimateDualDexTrade = async (_router1, _router2, _token1, _token2, _amount) => {
  const amtBack1 = await getAmountOutMin(_router1, _token1, _token2, _amount);
  const amtBack2 = await getAmountOutMin(_router2, _token2, _token1, amtBack1);
  //console.log(`_router1 ${_router1} _router2 ${_router2}`);
  return amtBack2;
}

const combs = (array) => {
  return array.flatMap(
      (v, i) => array.slice(i+1).map( w => [[v, w], [w, v]] )
  )
}

const searchForRoutes = () => {
  const targetRoute = {};
  targetRoute.router1 = config.routers[Math.floor(Math.random()*config.routers.length)].address;
  targetRoute.router2 = config.routers[Math.floor(Math.random()*config.routers.length)].address;
  targetRoute.token1 = config.baseAssets[Math.floor(Math.random()*config.baseAssets.length)].address;
  targetRoute.token2 = config.tokens[Math.floor(Math.random()*config.tokens.length)].address;
  return targetRoute;
}

const searchAllRoutes = () => {
  list = [];
  for (let i = 0; i < config.routers.length; i++) {
    list.push(config.routers[i].address);
  }
  const routes = combs(list);
  const final_routes = []
  for (let i = 0; i < routes.length; i++) {
    final_routes.push(routes[i][0]);
    final_routes.push(routes[i][1]);
  }
  
  const allRoutes = [];
  for (let r = 0; r < final_routes.length; r++) {
    const route = final_routes[r];

    for (let b = 0; b < config.baseAssets.length; b++) {
      const asset = config.baseAssets[b].address;

      for (let t = 0; t < config.tokens.length; t++) {
        const token = config.tokens[t].address;

        const targetRoute = {};
        targetRoute.router1 = route[0];
        targetRoute.router2 = route[1];
        targetRoute.token1 = asset;
        targetRoute.token2 = token;
        if (asset != token){
          allRoutes.push(targetRoute);
        }
      }

    }
  }
  //console.log(allRoutes);
  return allRoutes;
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

async function processRoute(targetRoute) {
  try {
    let tradeSize = balances[targetRoute.token1].balance;
    const amtBack = await estimateDualDexTrade(targetRoute.router1, targetRoute.router2, targetRoute.token1, targetRoute.token2, tradeSize);
    const multiplier = ethers.BigNumber.from(config.minBasisPointsPerTrade + 10000);
    const sizeMultiplied = tradeSize.mul(multiplier);
    const divider = ethers.BigNumber.from(10000);
    const profitTarget = sizeMultiplied.div(divider);
    if (!config.routes.length > 0) {
      fs.appendFile(`./data/${network}RouteLog.txt`, `["${targetRoute.router1}","${targetRoute.router2}","${targetRoute.token1}","${targetRoute.token2}"],` + "\n", function (err) { });
    }
    if (amtBack.gt(profitTarget)) {
      console.log("Profit " + amtBack + " " + profitTarget + " " + targetRoute.token1 + " " + targetRoute.token2);
      //await dualTrade(targetRoute.router1,targetRoute.router2,targetRoute.token1,targetRoute.token2,tradeSize);
    } else {
      //await lookForDualTrade();
    }
  } catch (e) {
    //console.log(e);
    //await lookForDualTrade();
  }
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
  [owner] = await ethers.getSigners();
  console.log(`Owner: ${owner.address}`);
  //const IArb = await ethers.getContractFactory('Arb');
  //arb = await IArb.attach(config.arbContract);
  balances = {};
  for (let i = 0; i < config.baseAssets.length; i++) {
    const asset = config.baseAssets[i];
    //const interface = await ethers.getContractFactory('WETH9');
    //const assetToken = await interface.attach(asset.address);
    //const balance = await assetToken.balanceOf(config.arbContract);
    const balance = ethers.BigNumber.from(1000);
    console.log(asset.sym, balance.toString());
    balances[asset.address] = { sym: asset.sym, balance, startBalance: balance };
  }

  routers = []

  for (let i = 0; i < config.routers.length; i++) {
    const router = config.routers[i];
    const UniRouterV2 = await hre.ethers.getContractAt("contracts/Arb.sol:IUniswapV2Router", router.address);
    routers[router.address] = UniRouterV2;
  }

  setTimeout(() => {
    setInterval(() => {
      logResults();
    }, 600000);
    logResults();
  }, 120000);
}

const logResults = async () => {
  console.log(`############# LOGS #############`);
    for (let i = 0; i < config.baseAssets.length; i++) {
    const asset = config.baseAssets[i];
    const interface = await ethers.getContractFactory('WETH9');
    const assetToken = await interface.attach(asset.address);
    balances[asset.address].balance = await assetToken.balanceOf(config.arbContract);
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

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
