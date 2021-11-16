import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { Button, View, Text, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BigNumber } from 'bignumber.js';
import { StableToken } from '@celo/contractkit';
import { useContractKit, Alfajores } from '@celo-tools/use-contractkit';
import { ContractKitProvider, NetworkNames } from '@celo-tools/use-contractkit';
import { Toaster } from 'react-hot-toast';
import Web3 from 'web3';
// import '@celo-tools/use-contractkit/lib/styles.css';

const defaultSummary = {
  name: '',
  address: '',
  wallet: '',
  celo: new BigNumber(0),
  cusd: new BigNumber(0)
};

function truncateAddress(address: string|null) {
  if (!address) {
    return "";
  }
  return `${address.slice(0, 8)}...${address.slice(36)}`;
}

function App() {
  const {
    kit,
    address,
    network,
    updateNetwork,
    connect,
    destroy,
    performActions,
    walletType,
  } = useContractKit();
  const [summary, setSummary] = useState(defaultSummary);

  /**
   * Fetches account summary and token balances
   */
  const fetchSummary = useCallback(async () => {
    if (!address) {
      setSummary(defaultSummary);
      return;
    }

    const [accounts, goldToken, cUSD] = await Promise.all([
      kit.contracts.getAccounts(),
      kit.contracts.getGoldToken(),
      kit.contracts.getStableToken(StableToken.cUSD)
    ]);
    const [summary, celo, cusd] = await Promise.all([
      accounts.getAccountSummary(address).catch((e) => {
        console.error(e);
        return defaultSummary;
      }),
      goldToken.balanceOf(address),
      cUSD.balanceOf(address),
    ]);
    setSummary({
      ...summary,
      celo,
      cusd,
    });
  }, [address, kit]);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  return (
    <SafeAreaProvider>
      {address ? 
          (<Button title="Disconnect" onPress={() => 
            destroy().catch((e: Error) => console.error(e.message))
          } />)
          : 
          (<Button title="Connect" onPress={() =>
              connect().catch((e: Error) => console.error(e.message))
          } />)
        }
        <View style={styles.walletContainer}>
          <Text style={styles.walletText}>Wallet Information:</Text>
          <Text style={styles.walletText}>Network: {network.name}</Text>
          <Text style={styles.walletText}>Address: {truncateAddress(address)}</Text>
          <Text style={styles.walletText}>Celo: {Web3.utils.fromWei(summary.celo.toFixed())}</Text>
          <Text style={styles.walletText}>cUSD: {Web3.utils.fromWei(summary.cusd.toFixed())}</Text>
        </View>
      <StatusBar />
    </SafeAreaProvider>
  );
};

function WrappedApp() {
  return (
    <ContractKitProvider
    dapp={{
      name: 'HawalaCoin',
      description: 'A Dapp for getting money into hard places',
      url: 'https://hawalacoin.vercel.app/',
      icon: 'https://hawalacoin.vercel.app/favicon.ico',
    }}
    networks={[Alfajores]}
    network={{
      name: NetworkNames.Alfajores,
      rpcUrl: 'https://alfajores-forno.celo-testnet.org',
      graphQl: 'https://alfajores-blockscout.celo-testnet.org/graphiql',
      explorer: 'https://alfajores-blockscout.celo-testnet.org',
      chainId: 44787,
    }}
  >
    <Toaster
      position="top-right"
      toastOptions={{
        className: 'w-72 md:w-96',
        style: {
          padding: '0px',
        },
      }}
    />
    <App />
    </ContractKitProvider>
  );
}

export default WrappedApp;

const styles = StyleSheet.create({
  walletContainer: {
    alignItems: 'center',
    marginHorizontal: 50,
  },
  walletText: {
    fontSize: 17,
    lineHeight: 24,
    textAlign: 'center',
  },
});
