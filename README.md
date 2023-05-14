# Simple Dex Arbitrage


Build using the following commands:

```shell
mv .env-example.txt .env
npm install
```

Then add the arbContract deployment address to config/aurora.json edit the base assets and move the funds across to the the arbContract address.

Then to execute run:-

```shell
npx hardhat run --network binance scripts/deploy.js
npx hardhat run --network forking scripts/deploy.js
```

Finally to recover any funds use the script.

```shell
npx hardhat run --network aurora .\scripts\recover.js
```

More info and solidity tutorials on my blog at https://jamesbachini.com


Run node
```shell
npx hardhat node --fork https://rpc.ftm.tools/
npx hardhat node --fork https://bsc-dataseed.binance.org/
```

Run trader.

```shell
npx hardhat run --network fantom ./scripts/trade.js
```


Run balancer check.

```shell
npx hardhat run --network fantom ./scripts/balances.js 
```
