# HawalaCoin

A DApp for getting money into hard places

## Setup

This setup requires node 12 and yarn
```
nvm use 12
```

To install dependencies run
```
yarn
```

To run dev server
```
yarn dev
```

## Truffle

We use Truffle to manage our contracts locally.
If you make changes to the solidity contracts you'll need to run truffle compile in order to update the ABI which is used by the DApp
```
cd truffle
truffle compile
```

Note it's easiest to install truffle globally with
```
npm install --global truffle
```

