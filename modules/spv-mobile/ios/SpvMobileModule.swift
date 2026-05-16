import ExpoModulesCore

// MARK: - Record types (mirror Kotlin SpvMobileModule records exactly)

struct UtxoRecord: Record {
  init() {}
  @Field var txid: String = ""
  @Field var index: Int = 0
  @Field var value: Double = 0          // u64 → Double (JS-safe up to 2^53)
  @Field var height: Double = 0
  @Field var is_coinbase: Bool = false
  @Field var script_pubkey_hex: String = ""
}

struct BalanceInfoRecord: Record {
  init() {}
  @Field var confirmed: Double = 0
  @Field var utxo_count: Int = 0
  @Field var height: Double = 0
}

struct NodeStatusRecord: Record {
  init() {}
  @Field var height: Double = 0
  @Field var peer_count: Int = 0
  @Field var tip_hash: String = ""
  @Field var anchor_loaded: Bool = false
}

struct TxRecordRecord: Record {
  init() {}
  @Field var txid: String = ""
  @Field var height: Double = 0
  @Field var net_sats: Double = 0       // i64 → Double
  @Field var direction: String = "in"
}

struct HtlcInfoRecord: Record {
  init() {}
  @Field var secret_hash_hex: String = ""
  @Field var recipient_address: String = ""
  @Field var refund_address: String = ""
  @Field var timeout_height: Double = 0
}

struct WifKeyRecord: Record {
  init() {}
  @Field var address: String = ""
  @Field var pubkey_hex: String = ""
}

struct LightClientConfigRecord: Record {
  init() {}
  @Field var seedlist_path: String = ""
  @Field var extra_peer: String? = nil
  @Field var start_height: Double = 0
  @Field var start_hash: String? = nil
}

struct AgreementParamsRecord: Record {
  init() {}
  @Field var template_type: String = ""
  @Field var payer_address: String = ""
  @Field var payee_address: String = ""
  @Field var total_amount_sats: Double = 0
  @Field var timeout_height: Double = 0
  @Field var secret_hash_hex: String = ""
  @Field var asset_reference: String? = nil
  @Field var payment_reference: String? = nil
  @Field var document_hash: String? = nil
}

struct HtlcClaimParamsRecord: Record {
  init() {}
  @Field var htlc_txid: String = ""
  @Field var htlc_index: Int = 0
  @Field var htlc_value: Double = 0
  @Field var htlc_script_hex: String = ""
  @Field var preimage_hex: String = ""
  @Field var seed_hex: String = ""
  @Field var key_index: Int = 0
  @Field var to_address: String = ""
  @Field var fee_sats: Double = 0
}

struct HtlcRefundParamsRecord: Record {
  init() {}
  @Field var htlc_txid: String = ""
  @Field var htlc_index: Int = 0
  @Field var htlc_value: Double = 0
  @Field var htlc_script_hex: String = ""
  @Field var seed_hex: String = ""
  @Field var key_index: Int = 0
  @Field var to_address: String = ""
  @Field var fee_sats: Double = 0
  @Field var timeout_height: Double = 0
}

// MARK: - Helpers

private func requireOk(_ result: String) throws -> String {
  if result.hasPrefix("ERROR:") {
    throw NSError(domain: "SpvMobile", code: 1,
      userInfo: [NSLocalizedDescriptionKey: String(result.dropFirst(6))])
  }
  return result
}

private func utxosToJson(_ utxos: [UtxoRecord]) throws -> String {
  let arr = utxos.map { u -> [String: Any] in
    return [
      "txid": u.txid,
      "index": u.index,
      "value": Int64(u.value),
      "height": Int64(u.height),
      "is_coinbase": u.is_coinbase,
      "script_pubkey_hex": u.script_pubkey_hex,
    ]
  }
  let data = try JSONSerialization.data(withJSONObject: arr)
  return String(data: data, encoding: .utf8) ?? "[]"
}

private func parseJson(_ json: String) throws -> [String: Any] {
  guard let data = json.data(using: .utf8),
        let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any]
  else { throw NSError(domain: "SpvMobile", code: 2, userInfo: [NSLocalizedDescriptionKey: "JSON parse error"]) }
  return obj
}

private func parseJsonArray(_ json: String) throws -> [[String: Any]] {
  guard let data = json.data(using: .utf8),
        let arr = try JSONSerialization.jsonObject(with: data) as? [[String: Any]]
  else { throw NSError(domain: "SpvMobile", code: 2, userInfo: [NSLocalizedDescriptionKey: "JSON array parse error"]) }
  return arr
}

// MARK: - Module
//
// This module calls UniFFI-generated Swift functions from spv_mobile.swift,
// which is placed alongside this file in ios/ and compiled into the same pod.
// Run `uniffi-bindgen generate rust-bridge/src/spv_mobile.udl --language swift
//      --out-dir modules/spv-mobile/ios/` on a Mac to produce spv_mobile.swift.

public class SpvMobileModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SpvMobileModule")

    // MARK: Wallet

    AsyncFunction("generateMnemonic") { () throws -> String in
      try requireOk(nativeGenerateMnemonic())
    }

    AsyncFunction("mnemonicToSeed") { (mnemonic: String, passphrase: String) throws -> String in
      try requireOk(nativeMnemonicToSeed(mnemonic: mnemonic, passphrase: passphrase))
    }

    AsyncFunction("deriveAddress") { (seedHex: String, index: Int) throws -> String in
      try requireOk(nativeDeriveAddress(seedHex: seedHex, index: UInt32(index)))
    }

    AsyncFunction("derivePrivkeyHex") { (seedHex: String, index: Int) throws -> String in
      try requireOk(nativeDerivePrivkeyHex(seedHex: seedHex, index: UInt32(index)))
    }

    Function("validateAddress") { (address: String) -> Bool in
      nativeValidateAddress(address: address)
    }

    AsyncFunction("exportWif") { (seedHex: String, index: Int) throws -> String in
      try requireOk(nativeExportWif(seedHex: seedHex, index: UInt32(index)))
    }

    AsyncFunction("importWif") { (wif: String) throws -> WifKeyRecord in
      let json = try requireOk(nativeImportWif(wif: wif))
      let obj  = try parseJson(json)
      var r    = WifKeyRecord()
      r.address    = obj["address"]    as? String ?? ""
      r.pubkey_hex = obj["pubkey_hex"] as? String ?? ""
      return r
    }

    // MARK: Transaction building

    AsyncFunction("buildSendTx") { (utxos: [UtxoRecord], toAddress: String,
                                    amountSats: Double, feeSats: Double,
                                    seedHex: String, fromIndex: Int) throws -> String in
      let utxosJson = try utxosToJson(utxos)
      return try requireOk(nativeBuildSendTx(
        utxosJson: utxosJson, toAddress: toAddress,
        amountSats: UInt64(amountSats), feeSats: UInt64(feeSats),
        seedHex: seedHex, fromIndex: UInt32(fromIndex)
      ))
    }

    // MARK: HTLC

    AsyncFunction("encodeHtlcv1") { (secretHashHex: String, recipientAddress: String,
                                     refundAddress: String, timeoutHeight: Double) throws -> String in
      try requireOk(nativeEncodeHtlcv1(
        secretHashHex: secretHashHex, recipientAddress: recipientAddress,
        refundAddress: refundAddress, timeoutHeight: UInt64(timeoutHeight)
      ))
    }

    AsyncFunction("decodeHtlcv1") { (scriptHex: String) throws -> HtlcInfoRecord in
      let json = try requireOk(nativeDecodeHtlcv1(scriptHex: scriptHex))
      let obj  = try parseJson(json)
      var r    = HtlcInfoRecord()
      r.secret_hash_hex    = obj["secret_hash_hex"]    as? String ?? ""
      r.recipient_address  = obj["recipient_address"]  as? String ?? ""
      r.refund_address     = obj["refund_address"]     as? String ?? ""
      r.timeout_height     = obj["timeout_height"].flatMap { Double(exactly: $0 as AnyObject) } ?? 0
      return r
    }

    AsyncFunction("buildHtlcClaimTx") { (params: HtlcClaimParamsRecord) throws -> String in
      try requireOk(nativeBuildHtlcClaimTx(
        htlcTxid: params.htlc_txid, htlcIndex: UInt32(params.htlc_index),
        htlcValue: UInt64(params.htlc_value), htlcScriptHex: params.htlc_script_hex,
        preimageHex: params.preimage_hex, seedHex: params.seed_hex,
        keyIndex: UInt32(params.key_index), toAddress: params.to_address,
        feeSats: UInt64(params.fee_sats)
      ))
    }

    AsyncFunction("buildHtlcRefundTx") { (params: HtlcRefundParamsRecord) throws -> String in
      try requireOk(nativeBuildHtlcRefundTx(
        htlcTxid: params.htlc_txid, htlcIndex: UInt32(params.htlc_index),
        htlcValue: UInt64(params.htlc_value), htlcScriptHex: params.htlc_script_hex,
        seedHex: params.seed_hex, keyIndex: UInt32(params.key_index),
        toAddress: params.to_address, feeSats: UInt64(params.fee_sats),
        timeoutHeight: UInt64(params.timeout_height)
      ))
    }

    // MARK: Agreement

    AsyncFunction("computeAgreementHash") { (agreementJson: String) throws -> String in
      try requireOk(nativeComputeAgreementHash(agreementJson: agreementJson))
    }

    AsyncFunction("createAgreement") { (params: AgreementParamsRecord) throws -> String in
      try requireOk(nativeCreateAgreement(
        templateType: params.template_type,
        payerAddress: params.payer_address,
        payeeAddress: params.payee_address,
        totalAmountSats: UInt64(params.total_amount_sats),
        timeoutHeight: UInt64(params.timeout_height),
        secretHashHex: params.secret_hash_hex,
        assetReference: params.asset_reference ?? "",
        paymentReference: params.payment_reference ?? "",
        documentHash: params.document_hash ?? ""
      ))
    }

    // MARK: SPV

    AsyncFunction("verifyMerkleProof") { (txidHex: String, merkleRootHex: String,
                                          proofHexNodes: [String], index: Double) throws -> Bool in
      let proofData = try JSONSerialization.data(withJSONObject: proofHexNodes)
      let proofJson = String(data: proofData, encoding: .utf8) ?? "[]"
      return nativeVerifyMerkleProof(
        txidHex: txidHex, merkleRootHex: merkleRootHex,
        proofHexNodesJson: proofJson, index: UInt64(index)
      )
    }

    Function("getSyncedHeight") { () -> Double in Double(nativeGetSyncedHeight()) }
    Function("getTipHash") { () -> String in nativeGetTipHash() }

    // MARK: RPC

    AsyncFunction("rpcGetStatus") { (rpcUrl: String, authToken: String?) throws -> NodeStatusRecord in
      let json = try requireOk(nativeRpcGetStatus(rpcUrl: rpcUrl, authToken: authToken ?? ""))
      let obj  = try parseJson(json)
      var r    = NodeStatusRecord()
      r.height        = (obj["height"]       as? Double) ?? 0
      r.peer_count    = (obj["peer_count"]   as? Int)    ?? 0
      r.tip_hash      = (obj["tip_hash"]     as? String) ?? ""
      r.anchor_loaded = (obj["anchor_loaded"] as? Bool)  ?? false
      return r
    }

    AsyncFunction("rpcGetBalance") { (rpcUrl: String, authToken: String?, address: String) throws -> BalanceInfoRecord in
      let json = try requireOk(nativeRpcGetBalance(rpcUrl: rpcUrl, authToken: authToken ?? "", address: address))
      let obj  = try parseJson(json)
      var r    = BalanceInfoRecord()
      r.confirmed   = (obj["confirmed"]   as? Double) ?? 0
      r.utxo_count  = (obj["utxo_count"]  as? Int)    ?? 0
      r.height      = (obj["height"]      as? Double) ?? 0
      return r
    }

    AsyncFunction("rpcGetUtxos") { (rpcUrl: String, authToken: String?, address: String) throws -> [UtxoRecord] in
      let json = try requireOk(nativeRpcGetUtxos(rpcUrl: rpcUrl, authToken: authToken ?? "", address: address))
      return try parseJsonArray(json).map { obj in
        var r = UtxoRecord()
        r.txid             = (obj["txid"]            as? String) ?? ""
        r.index            = (obj["index"]           as? Int)    ?? 0
        r.value            = (obj["value"]           as? Double) ?? 0
        r.height           = (obj["height"]          as? Double) ?? 0
        r.is_coinbase      = (obj["is_coinbase"]     as? Bool)   ?? false
        r.script_pubkey_hex = (obj["script_pubkey_hex"] as? String) ?? ""
        return r
      }
    }

    AsyncFunction("rpcGetHistory") { (rpcUrl: String, authToken: String?, address: String) throws -> [TxRecordRecord] in
      let json = try requireOk(nativeRpcGetHistory(rpcUrl: rpcUrl, authToken: authToken ?? "", address: address))
      return try parseJsonArray(json).map { obj in
        var r = TxRecordRecord()
        r.txid      = (obj["txid"]      as? String) ?? ""
        r.height    = (obj["height"]    as? Double) ?? 0
        r.net_sats  = (obj["net_sats"]  as? Double) ?? 0
        r.direction = (obj["direction"] as? String) ?? "in"
        return r
      }
    }

    AsyncFunction("rpcGetFeeRate") { (rpcUrl: String, authToken: String?) throws -> Double in
      Double(nativeRpcGetFeeRate(rpcUrl: rpcUrl, authToken: authToken ?? ""))
    }

    AsyncFunction("rpcSubmitTx") { (rpcUrl: String, authToken: String?, txHex: String) throws -> String in
      try requireOk(nativeRpcSubmitTx(rpcUrl: rpcUrl, authToken: authToken ?? "", txHex: txHex))
    }

    // MARK: Light client

    AsyncFunction("startLightClient") { (config: LightClientConfigRecord) throws in
      let resolved = self.resolveSeedlistPath(config.seedlist_path)
      let result = nativeStartLightClient(
        seedlistPath: resolved,
        extraPeer: config.extra_peer ?? "",
        startHeight: UInt64(config.start_height),
        startHash: config.start_hash ?? ""
      )
      _ = try requireOk(result)
    }

    Function("stopLightClient") { () in nativeStopLightClient() }
    Function("isSyncing") { () -> Bool in nativeIsSyncing() }
    Function("peerCount") { () -> Int in Int(nativePeerCount()) }

    AsyncFunction("broadcastTx") { (txHex: String) throws -> String in
      try requireOk(nativeBroadcastTx(txHex: txHex))
    }
  }

  // If path starts with "assets/", copy the bundled file to the app's Documents
  // directory (writable by Rust's std::fs) and return that path.
  private func resolveSeedlistPath(_ path: String) -> String {
    guard path.hasPrefix("assets/") else { return path }
    let assetName = String(path.dropFirst(7))
    guard let bundlePath = Bundle.main.path(forResource: assetName, ofType: nil) else { return path }
    let dest = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("seedlist.txt")
    try? FileManager.default.copyItem(atPath: bundlePath, toPath: dest.path)
    return dest.path
  }
}
