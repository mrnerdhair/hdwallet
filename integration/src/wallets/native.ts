import * as core from "@shapeshiftoss/hdwallet-core";
import * as native from "@shapeshiftoss/hdwallet-native";
import merge from "lodash/merge";

// TODO: clean this up
// eslint-disable-next-line jest/no-mocks-import
import mswMock from "../../../packages/hdwallet-native/__mocks__/mswMock";

const mnemonic = "all all all all all all all all all all all all";
const deviceId = "native-test";

export function name(): string {
  return "Native";
}

export function createInfo(): core.HDWalletInfo {
  return native.info();
}

export async function setupMswMocks() {
  const binanceMocks = {
    get: {
      "https://dex.binance.org/api/v1/node-info": {
        node_info: {
          protocol_version: { p2p: 7, block: 10, app: 0 },
          id: "46ba46d5b6fcb61b7839881a75b081123297f7cf",
          listen_addr: "10.212.32.84:27146",
          network: "Binance-Chain-Tigris",
          version: "0.32.3",
          channels: "3640202122233038",
          moniker: "Ararat",
          other: { tx_index: "on", rpc_address: "tcp://0.0.0.0:27147" },
        },
        sync_info: {
          latest_block_hash: "307E98FD4A06AB02688C8539FF448431D521A3BB1C4D053DE3FBF1AD63276BA9",
          latest_app_hash: "A868C9E3186A4A8D562F73F3F53DB768F7F690478BF4D2C293A0F77F2E0C94DE",
          latest_block_height: 151030266,
          latest_block_time: "2021-03-18T20:42:11.972086064Z",
          catching_up: false,
        },
        validator_info: {
          address: "B7707D9F593C62E85BB9E1A2366D12A97CD5DFF2",
          pub_key: [
            113, 242, 215, 184, 236, 28, 139, 153, 166, 83, 66, 155, 1, 24, 205, 32, 31, 121, 79, 64, 157, 15, 234, 77,
            101, 177, 182, 98, 242, 176, 0, 99,
          ],
          voting_power: 1000000000000,
        },
      },
      "https://dex.binance.org/api/v1/account/bnb1qzc0v2q7u6484czzal6ncuvqmg9fae8n2xe2c6": {
        account_number: 123,
        address: "bnb1qzc0v2q7u6484czzal6ncuvqmg9fae8n2xe2c6",
        balances: [{ free: "0.00000000", frozen: "0.00000000", locked: "0.00000000", symbol: "BNB" }],
        flags: 0,
        public_key: null,
        sequence: 456,
      },
    },
  };

  return mswMock(merge({}, binanceMocks)).startServer();
}

export async function createWallet(): Promise<core.HDWallet> {
  await setupMswMocks();
  const wallet = new native.NativeHDWallet({ mnemonic, deviceId });
  await wallet.initialize();
  return wallet;
}

export function selfTest(get: () => core.HDWallet): void {
  let wallet: native.NativeHDWallet;

  beforeAll(async () => {
    const w = get() as native.NativeHDWallet;

    if (native.isNative(w) && core.supportsBTC(w) && core.supportsETH(w)) {
      wallet = w;
    } else {
      throw new Error("Wallet is not native");
    }
  });

  it("supports Ethereum mainnet", async () => {
    if (!wallet) return;
    expect(await wallet.ethSupportsNetwork()).toEqual(true);
  });

  it("does not support Native ShapeShift", async () => {
    if (!wallet) return;
    expect(wallet.ethSupportsNativeShapeShift()).toEqual(false);
    expect(wallet.btcSupportsNativeShapeShift()).toEqual(false);
  });

  it("does not support Secure Transfer", async () => {
    if (!wallet) return;
    expect(await wallet.ethSupportsSecureTransfer()).toEqual(false);
    expect(await wallet.btcSupportsSecureTransfer()).toEqual(false);
  });

  it("supports bip44 accounts", async () => {
    if (!wallet) return;
    expect(wallet.supportsBip44Accounts()).toEqual(true);
  });

  it("uses correct eth bip44 paths", () => {
    if (!wallet) return;
    [0, 1, 3, 27].forEach((account) => {
      const paths = core.mustBeDefined(
        wallet.ethGetAccountPaths({
          coin: "Ethereum",
          accountIdx: account,
        })
      );
      expect(paths).toEqual([
        {
          addressNList: core.bip32ToAddressNList(`m/44'/60'/${account}'/0/0`),
          hardenedPath: core.bip32ToAddressNList(`m/44'/60'/${account}'`),
          relPath: [0, 0],
          description: "Native",
        },
      ]);
      paths.forEach((path) => {
        expect(
          wallet.describePath({
            coin: "Ethereum",
            path: path.addressNList,
          }).isKnown
        ).toBeTruthy();
      });
    });
  });

  it("uses correct btc bip44 paths", () => {
    if (!wallet) return;

    const paths = wallet.btcGetAccountPaths({
      coin: "Litecoin",
      accountIdx: 3,
    });

    expect(paths).toEqual([
      {
        addressNList: [2147483692, 2147483650, 2147483651],
        scriptType: core.BTCInputScriptType.SpendAddress,
        coin: "Litecoin",
      },
      {
        addressNList: [2147483697, 2147483650, 2147483651],
        scriptType: core.BTCInputScriptType.SpendP2SHWitness,
        coin: "Litecoin",
      },
      {
        addressNList: [2147483732, 2147483650, 2147483651],
        scriptType: core.BTCInputScriptType.SpendWitness,
        coin: "Litecoin",
      },
    ]);
  });

  // eslint-disable-next-line jest/no-disabled-tests
  it.skip("supports ethNextAccountPath", () => {
    if (!wallet) return;

    const paths = core.mustBeDefined(
      wallet.ethGetAccountPaths({
        coin: "Ethereum",
        accountIdx: 5,
      })
    );

    expect(
      paths
        .map((path) => core.mustBeDefined(wallet.ethNextAccountPath(path)))
        .map((path) =>
          wallet.describePath({
            ...path,
            coin: "Ethereum",
            path: path.addressNList,
          })
        )
    ).toEqual([
      {
        accountIdx: 6,
        coin: "Ethereum",
        isKnown: true,
        verbose: "Ethereum Account #6",
        wholeAccount: true,
        isPrefork: false,
      },
    ]);
  });

  it("supports btcNextAccountPath", () => {
    if (!wallet) return;

    const paths = core.mustBeDefined(
      wallet.btcGetAccountPaths({
        coin: "Litecoin",
        accountIdx: 3,
      })
    );

    expect(
      paths
        .map((path) => core.mustBeDefined(wallet.btcNextAccountPath(path)))
        .map((path) =>
          wallet.describePath({
            ...path,
            path: path.addressNList,
          })
        )
    ).toEqual([
      {
        accountIdx: 4,
        coin: "Litecoin",
        isKnown: true,
        scriptType: "p2pkh",
        verbose: "Litecoin Account #4 (Legacy)",
        wholeAccount: true,
        isPrefork: false,
      },
      {
        accountIdx: 4,
        coin: "Litecoin",
        isKnown: true,
        scriptType: "p2sh-p2wpkh",
        verbose: "Litecoin Account #4",
        wholeAccount: true,
        isPrefork: false,
      },
      {
        accountIdx: 4,
        coin: "Litecoin",
        isKnown: true,
        scriptType: "p2wpkh",
        verbose: "Litecoin Account #4 (Segwit)",
        wholeAccount: true,
        isPrefork: false,
      },
    ]);
  });

  it("returns true for supportsBip44Accounts", () => {
    expect(wallet.supportsBip44Accounts()).toBe(true);
  });

  it("can describe a Bitcoin path", () => {
    expect(
      wallet.describePath({
        path: core.bip32ToAddressNList("m/44'/0'/0'/0/0"),
        coin: "Bitcoin",
        scriptType: core.BTCInputScriptType.SpendAddress,
      })
    ).toEqual({
      verbose: "Bitcoin Account #0, Address #0 (Legacy)",
      coin: "Bitcoin",
      isKnown: true,
      scriptType: core.BTCInputScriptType.SpendAddress,
      accountIdx: 0,
      addressIdx: 0,
      wholeAccount: false,
      isChange: false,
      isPrefork: false,
    });
  });

  it("can describe a Bitcoin bech32 path", () => {
    expect(
      wallet.describePath({
        path: core.bip32ToAddressNList("m/84'/0'/0'/0/0"),
        coin: "Bitcoin",
        scriptType: core.BTCInputScriptType.Bech32,
      })
    ).toEqual({
      verbose: "Bitcoin Account #0, Address #0 (Segwit Native)",
      coin: "Bitcoin",
      isKnown: true,
      scriptType: core.BTCInputScriptType.Bech32,
      accountIdx: 0,
      addressIdx: 0,
      wholeAccount: false,
      isChange: false,
      isPrefork: false,
    });
  });

  it("can describe Bitcoin Change Addresses", () => {
    expect(
      wallet.describePath({
        path: core.bip32ToAddressNList("m/44'/0'/7'/1/5"),
        coin: "Bitcoin",
        scriptType: core.BTCInputScriptType.SpendAddress,
      })
    ).toEqual({
      verbose: "Bitcoin Account #7, Change Address #5 (Legacy)",
      coin: "Bitcoin",
      isKnown: true,
      scriptType: core.BTCInputScriptType.SpendAddress,
      accountIdx: 7,
      addressIdx: 5,
      wholeAccount: false,
      isChange: true,
      isPrefork: false,
    });
  });

  // eslint-disable-next-line jest/no-disabled-tests
  it.skip("can describe prefork BitcoinCash", () => {
    expect(
      wallet.describePath({
        path: core.bip32ToAddressNList("m/44'/0'/0'/0/0"),
        coin: "BitcoinCash",
        scriptType: core.BTCInputScriptType.SpendAddress,
      })
    ).toEqual({
      verbose: "BitcoinCash Account #0, Address #0 (Prefork)",
      coin: "BitcoinCash",
      isKnown: true,
      scriptType: core.BTCInputScriptType.SpendAddress,
      accountIdx: 0,
      addressIdx: 0,
      wholeAccount: false,
      isChange: false,
      isPrefork: true,
    });
  });

  // eslint-disable-next-line jest/no-disabled-tests
  it.skip("can describe prefork Segwit Native BTG", () => {
    expect(
      wallet.describePath({
        path: core.bip32ToAddressNList("m/84'/0'/0'/0/0"),
        coin: "BitcoinGold",
        scriptType: core.BTCInputScriptType.SpendWitness,
      })
    ).toEqual({
      verbose: "BitcoinGold Account #0, Address #0 (Prefork, Segwit Native)",
      coin: "BitcoinGold",
      isKnown: true,
      scriptType: core.BTCInputScriptType.SpendWitness,
      accountIdx: 0,
      addressIdx: 0,
      wholeAccount: false,
      isChange: false,
      isPrefork: true,
    });
  });

  // eslint-disable-next-line jest/no-disabled-tests
  it.skip("can describe prefork paths", () => {
    expect(
      wallet.describePath({
        path: core.bip32ToAddressNList("m/44'/0'/7'/1/5"),
        coin: "BitcoinCash",
        scriptType: core.BTCInputScriptType.SpendAddress,
      })
    ).toEqual({
      accountIdx: 7,
      addressIdx: 5,
      coin: "BitcoinCash",
      isChange: true,
      isKnown: true,
      isPrefork: true,
      scriptType: "p2pkh",
      verbose: "BitcoinCash Account #7, Change Address #5 (Prefork)",
      wholeAccount: false,
    });
  });

  it("can describe ETH paths", () => {
    expect(
      wallet.describePath({
        path: core.bip32ToAddressNList("m/44'/60'/0'/0/0"),
        coin: "Ethereum",
      })
    ).toEqual({
      verbose: "Ethereum Account #0",
      coin: "Ethereum",
      isKnown: true,
      accountIdx: 0,
      wholeAccount: true,
      isPrefork: false,
    });

    expect(
      wallet.describePath({
        path: core.bip32ToAddressNList("m/44'/60'/3'/0/0"),
        coin: "Ethereum",
      })
    ).toEqual({
      verbose: "Ethereum Account #3",
      coin: "Ethereum",
      isKnown: true,
      accountIdx: 3,
      wholeAccount: true,
      isPrefork: false,
    });

    expect(
      wallet.describePath({
        path: core.bip32ToAddressNList("m/44'/60'/0'/0/3"),
        coin: "Ethereum",
      })
    ).toEqual({
      verbose: "m/44'/60'/0'/0/3",
      coin: "Ethereum",
      isKnown: false,
    });
  });
}
