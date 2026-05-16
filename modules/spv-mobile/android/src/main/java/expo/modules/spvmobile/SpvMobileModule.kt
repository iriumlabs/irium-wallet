package expo.modules.spvmobile

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

// ---------- Record types (match UDL dictionaries exactly) ----------

class UtxoRecord : Record {
    @Field var txid: String = ""
    @Field var index: Int = 0
    @Field var value: Long = 0
    @Field var height: Long = 0
    @Field var is_coinbase: Boolean = false
    @Field var script_pubkey_hex: String = ""
}

class BalanceInfoRecord : Record {
    @Field var confirmed: Long = 0
    @Field var utxo_count: Int = 0
    @Field var height: Long = 0
}

class NodeStatusRecord : Record {
    @Field var height: Long = 0
    @Field var peer_count: Int = 0
    @Field var tip_hash: String = ""
    @Field var anchor_loaded: Boolean = false
}

class TxRecordRecord : Record {
    @Field var txid: String = ""
    @Field var height: Long = 0
    @Field var net_sats: Long = 0
    @Field var direction: String = "in"
}

class HtlcInfoRecord : Record {
    @Field var secret_hash_hex: String = ""
    @Field var recipient_address: String = ""
    @Field var refund_address: String = ""
    @Field var timeout_height: Long = 0
}

class WifKeyRecord : Record {
    @Field var address: String = ""
    @Field var pubkey_hex: String = ""
}

class LightClientConfigRecord : Record {
    @Field var seedlist_path: String = ""
    @Field var extra_peer: String? = null
    @Field var start_height: Long = 0
    @Field var start_hash: String? = null
}

class AgreementParamsRecord : Record {
    @Field var template_type: String = ""
    @Field var payer_address: String = ""
    @Field var payee_address: String = ""
    @Field var total_amount_sats: Long = 0
    @Field var timeout_height: Long = 0
    @Field var secret_hash_hex: String = ""
    @Field var asset_reference: String? = null
    @Field var payment_reference: String? = null
    @Field var document_hash: String? = null
}

// Expo DSL caps at 8 typed params; wrap 9-param HTLC functions in a Record.
class HtlcClaimParamsRecord : Record {
    @Field var htlc_txid: String = ""
    @Field var htlc_index: Int = 0
    @Field var htlc_value: Long = 0
    @Field var htlc_script_hex: String = ""
    @Field var preimage_hex: String = ""
    @Field var seed_hex: String = ""
    @Field var key_index: Int = 0
    @Field var to_address: String = ""
    @Field var fee_sats: Long = 0
}

class HtlcRefundParamsRecord : Record {
    @Field var htlc_txid: String = ""
    @Field var htlc_index: Int = 0
    @Field var htlc_value: Long = 0
    @Field var htlc_script_hex: String = ""
    @Field var seed_hex: String = ""
    @Field var key_index: Int = 0
    @Field var to_address: String = ""
    @Field var fee_sats: Long = 0
    @Field var timeout_height: Long = 0
}

// ---------- JNI singleton ----------

internal object SpvNative {
    init {
        System.loadLibrary("spv_mobile")
    }

    external fun nativePeerCount(): Int
    external fun nativeGetSyncedHeight(): Long
    external fun nativeIsSyncing(): Byte
    external fun nativeGetTipHash(): String
    external fun nativeStartLightClient(
        seedlistPath: String, extraPeer: String, startHeight: Long, startHash: String
    ): String
    external fun nativeStopLightClient()
    external fun nativeBroadcastTx(txHex: String): String

    external fun nativeGenerateMnemonic(): String
    external fun nativeMnemonicToSeed(mnemonic: String, passphrase: String): String
    external fun nativeDeriveAddress(seedHex: String, index: Int): String
    external fun nativeDerivePrivkeyHex(seedHex: String, index: Int): String
    external fun nativeValidateAddress(address: String): Byte
    external fun nativeExportWif(seedHex: String, index: Int): String
    external fun nativeImportWif(wif: String): String

    external fun nativeBuildSendTx(
        utxosJson: String, toAddress: String,
        amountSats: Long, feeSats: Long, seedHex: String, fromIndex: Int
    ): String

    external fun nativeEncodeHtlcv1(
        secretHashHex: String, recipientAddress: String,
        refundAddress: String, timeoutHeight: Long
    ): String
    external fun nativeDecodeHtlcv1(scriptHex: String): String
    external fun nativeBuildHtlcClaimTx(
        htlcTxid: String, htlcIndex: Int, htlcValue: Long, htlcScriptHex: String,
        preimageHex: String, seedHex: String, keyIndex: Int, toAddress: String, feeSats: Long
    ): String
    external fun nativeBuildHtlcRefundTx(
        htlcTxid: String, htlcIndex: Int, htlcValue: Long, htlcScriptHex: String,
        seedHex: String, keyIndex: Int, toAddress: String, feeSats: Long, timeoutHeight: Long
    ): String

    external fun nativeComputeAgreementHash(agreementJson: String): String
    external fun nativeCreateAgreement(
        templateType: String, payerAddress: String, payeeAddress: String,
        totalAmountSats: Long, timeoutHeight: Long, secretHashHex: String,
        assetReference: String, paymentReference: String, documentHash: String
    ): String

    external fun nativeVerifyMerkleProof(
        txidHex: String, merkleRootHex: String, proofHexNodesJson: String, index: Long
    ): Byte

    external fun nativeRpcGetStatus(rpcUrl: String, authToken: String): String
    external fun nativeRpcGetBalance(rpcUrl: String, authToken: String, address: String): String
    external fun nativeRpcGetUtxos(rpcUrl: String, authToken: String, address: String): String
    external fun nativeRpcGetHistory(rpcUrl: String, authToken: String, address: String): String
    external fun nativeRpcGetFeeRate(rpcUrl: String, authToken: String): Long
    external fun nativeRpcSubmitTx(rpcUrl: String, authToken: String, txHex: String): String
}

// ---------- Helpers ----------

private fun String.requireOk(): String {
    if (startsWith("ERROR:")) throw Exception(removePrefix("ERROR:"))
    return this
}

private fun List<UtxoRecord>.toJson(): String {
    val arr = JSONArray()
    forEach { u ->
        arr.put(JSONObject().apply {
            put("txid", u.txid)
            put("index", u.index)
            put("value", u.value)
            put("height", u.height)
            put("is_coinbase", u.is_coinbase)
            put("script_pubkey_hex", u.script_pubkey_hex)
        })
    }
    return arr.toString()
}

// ---------- Module ----------

class SpvMobileModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("SpvMobileModule")

        // --- Wallet ---

        AsyncFunction("generateMnemonic") {
            SpvNative.nativeGenerateMnemonic().requireOk()
        }

        AsyncFunction("mnemonicToSeed") { mnemonic: String, passphrase: String ->
            SpvNative.nativeMnemonicToSeed(mnemonic, passphrase).requireOk()
        }

        AsyncFunction("deriveAddress") { seedHex: String, index: Int ->
            SpvNative.nativeDeriveAddress(seedHex, index).requireOk()
        }

        AsyncFunction("derivePrivkeyHex") { seedHex: String, index: Int ->
            SpvNative.nativeDerivePrivkeyHex(seedHex, index).requireOk()
        }

        Function("validateAddress") { address: String ->
            SpvNative.nativeValidateAddress(address).toInt() == 1
        }

        AsyncFunction("exportWif") { seedHex: String, index: Int ->
            SpvNative.nativeExportWif(seedHex, index).requireOk()
        }

        AsyncFunction("importWif") { wif: String ->
            val json = SpvNative.nativeImportWif(wif).requireOk()
            val obj = JSONObject(json)
            val r = WifKeyRecord()
            r.address = obj.getString("address")
            r.pubkey_hex = obj.getString("pubkey_hex")
            r
        }

        // --- Transaction building ---

        AsyncFunction("buildSendTx") { utxos: List<UtxoRecord>, toAddress: String,
                                       amountSats: Long, feeSats: Long,
                                       seedHex: String, fromIndex: Int ->
            SpvNative.nativeBuildSendTx(utxos.toJson(), toAddress, amountSats, feeSats, seedHex, fromIndex)
                .requireOk()
        }

        // --- HTLC ---

        AsyncFunction("encodeHtlcv1") { secretHashHex: String, recipientAddress: String,
                                        refundAddress: String, timeoutHeight: Long ->
            SpvNative.nativeEncodeHtlcv1(secretHashHex, recipientAddress, refundAddress, timeoutHeight)
                .requireOk()
        }

        AsyncFunction("decodeHtlcv1") { scriptHex: String ->
            val json = SpvNative.nativeDecodeHtlcv1(scriptHex).requireOk()
            val obj = JSONObject(json)
            val r = HtlcInfoRecord()
            r.secret_hash_hex = obj.getString("secret_hash_hex")
            r.recipient_address = obj.getString("recipient_address")
            r.refund_address = obj.getString("refund_address")
            r.timeout_height = obj.getLong("timeout_height")
            r
        }

        AsyncFunction("buildHtlcClaimTx") { params: HtlcClaimParamsRecord ->
            SpvNative.nativeBuildHtlcClaimTx(
                params.htlc_txid, params.htlc_index, params.htlc_value,
                params.htlc_script_hex, params.preimage_hex, params.seed_hex,
                params.key_index, params.to_address, params.fee_sats
            ).requireOk()
        }

        AsyncFunction("buildHtlcRefundTx") { params: HtlcRefundParamsRecord ->
            SpvNative.nativeBuildHtlcRefundTx(
                params.htlc_txid, params.htlc_index, params.htlc_value,
                params.htlc_script_hex, params.seed_hex, params.key_index,
                params.to_address, params.fee_sats, params.timeout_height
            ).requireOk()
        }

        // --- Agreement ---

        AsyncFunction("computeAgreementHash") { agreementJson: String ->
            SpvNative.nativeComputeAgreementHash(agreementJson).requireOk()
        }

        AsyncFunction("createAgreement") { params: AgreementParamsRecord ->
            SpvNative.nativeCreateAgreement(
                params.template_type, params.payer_address, params.payee_address,
                params.total_amount_sats, params.timeout_height, params.secret_hash_hex,
                params.asset_reference ?: "", params.payment_reference ?: "",
                params.document_hash ?: ""
            ).requireOk()
        }

        // --- SPV ---

        AsyncFunction("verifyMerkleProof") { txidHex: String, merkleRootHex: String,
                                             proofHexNodes: List<String>, index: Long ->
            val proofJson = JSONArray().apply { proofHexNodes.forEach { put(it) } }.toString()
            val result = SpvNative.nativeVerifyMerkleProof(txidHex, merkleRootHex, proofJson, index)
            result.toInt() == 1
        }

        Function("getSyncedHeight") { -> SpvNative.nativeGetSyncedHeight() }
        Function("getTipHash") { -> SpvNative.nativeGetTipHash() }

        // --- RPC ---

        AsyncFunction("rpcGetStatus") { rpcUrl: String, authToken: String? ->
            val json = SpvNative.nativeRpcGetStatus(rpcUrl, authToken ?: "").requireOk()
            val obj = JSONObject(json)
            val r = NodeStatusRecord()
            r.height = obj.getLong("height")
            r.peer_count = obj.getInt("peer_count")
            r.tip_hash = obj.getString("tip_hash")
            r.anchor_loaded = obj.getBoolean("anchor_loaded")
            r
        }

        AsyncFunction("rpcGetBalance") { rpcUrl: String, authToken: String?, address: String ->
            val json = SpvNative.nativeRpcGetBalance(rpcUrl, authToken ?: "", address).requireOk()
            val obj = JSONObject(json)
            val r = BalanceInfoRecord()
            r.confirmed = obj.getLong("confirmed")
            r.utxo_count = obj.getInt("utxo_count")
            r.height = obj.getLong("height")
            r
        }

        AsyncFunction("rpcGetUtxos") { rpcUrl: String, authToken: String?, address: String ->
            val json = SpvNative.nativeRpcGetUtxos(rpcUrl, authToken ?: "", address).requireOk()
            val arr = JSONArray(json)
            val list = mutableListOf<UtxoRecord>()
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                val r = UtxoRecord()
                r.txid = obj.getString("txid")
                r.index = obj.getInt("index")
                r.value = obj.getLong("value")
                r.height = obj.getLong("height")
                r.is_coinbase = obj.getBoolean("is_coinbase")
                r.script_pubkey_hex = obj.getString("script_pubkey_hex")
                list.add(r)
            }
            list
        }

        AsyncFunction("rpcGetHistory") { rpcUrl: String, authToken: String?, address: String ->
            val json = SpvNative.nativeRpcGetHistory(rpcUrl, authToken ?: "", address).requireOk()
            val arr = JSONArray(json)
            val list = mutableListOf<TxRecordRecord>()
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                val r = TxRecordRecord()
                r.txid = obj.getString("txid")
                r.height = obj.getLong("height")
                r.net_sats = obj.getLong("net_sats")
                r.direction = obj.getString("direction")
                list.add(r)
            }
            list
        }

        AsyncFunction("rpcGetFeeRate") { rpcUrl: String, authToken: String? ->
            SpvNative.nativeRpcGetFeeRate(rpcUrl, authToken ?: "")
        }

        AsyncFunction("rpcSubmitTx") { rpcUrl: String, authToken: String?, txHex: String ->
            SpvNative.nativeRpcSubmitTx(rpcUrl, authToken ?: "", txHex).requireOk()
        }

        // --- Light client ---

        AsyncFunction("startLightClient") { config: LightClientConfigRecord ->
            val resolvedPath = resolveSeedlistPath(config.seedlist_path)
            SpvNative.nativeStartLightClient(
                resolvedPath, config.extra_peer ?: "",
                config.start_height, config.start_hash ?: ""
            ).requireOk()
        }

        Function("stopLightClient") { -> SpvNative.nativeStopLightClient() }
        Function("isSyncing") { -> SpvNative.nativeIsSyncing().toInt() == 1 }
        Function("peerCount") { -> SpvNative.nativePeerCount() }

        AsyncFunction("broadcastTx") { txHex: String ->
            SpvNative.nativeBroadcastTx(txHex).requireOk()
        }
    }

    // If the caller passes an "assets/..." path, copy the bundled asset to the
    // app's internal files dir (writable by Rust's std::fs) and return that path.
    private fun resolveSeedlistPath(path: String): String {
        if (!path.startsWith("assets/")) return path
        val assetName = path.removePrefix("assets/")
        val ctx = appContext.reactContext ?: return path
        val dest = File(ctx.filesDir, "seedlist.txt")
        try {
            ctx.assets.open(assetName).use { input ->
                dest.outputStream().use { out -> input.copyTo(out) }
            }
        } catch (_: Exception) { /* asset missing — Rust will report the error */ }
        return dest.absolutePath
    }
}
