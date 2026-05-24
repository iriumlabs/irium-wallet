use sha2::{Digest, Sha256};
use std::time::{SystemTime, UNIX_EPOCH};

use irium_node_rs::settlement::{
    agreement_canonical_bytes, AgreementDeadlines, AgreementObject, AgreementParty,
    AgreementRefundCondition, AgreementReleaseCondition, AgreementTemplateType, AGREEMENT_NETWORK_MARKER,
    AGREEMENT_OBJECT_VERSION, AGREEMENT_SCHEMA_ID_V1,
};

pub struct AgreementParams {
    pub template_type: String,
    pub payer_address: String,
    pub payee_address: String,
    pub total_amount_sats: u64,
    pub timeout_height: u64,
    pub secret_hash_hex: String,
    pub asset_reference: Option<String>,
    pub payment_reference: Option<String>,
    pub document_hash: Option<String>,
}

/// SHA256 of the CANONICAL agreement bytes, returned as lowercase hex.
/// Matches iriumd's compute_agreement_hash_hex byte-for-byte by going
/// through the same agreement_canonical_bytes helper from irium-source:
/// parse JSON -> AgreementObject -> serde_json::to_value -> sort_json
/// (recursive lexicographic key sort) -> serde_json::to_vec (compact)
/// -> SHA256. Input JSON shape is hash-invariant: omitting a no-skip
/// Option<None> field vs sending it as null both deserialize to None and
/// re-serialize identically through the typed struct.
pub fn compute_agreement_hash(agreement_json: &str) -> Result<String, String> {
    let agreement: AgreementObject = serde_json::from_str(agreement_json)
        .map_err(|e| format!("parse agreement JSON: {e}"))?;
    let bytes = agreement_canonical_bytes(&agreement)?;
    let hash = Sha256::digest(&bytes);
    Ok(hex::encode(hash))
}

/// Build an AgreementObject from wizard params and return its canonical JSON.
pub fn create_agreement(params: AgreementParams) -> Result<String, String> {
    let template_type = parse_template_type(&params.template_type)?;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let agreement_id = {
        let mut h = Sha256::new();
        h.update(params.payer_address.as_bytes());
        h.update(params.payee_address.as_bytes());
        h.update(params.total_amount_sats.to_be_bytes());
        h.update(now.to_be_bytes());
        hex::encode(h.finalize())
    };

    let document_hash = params
        .document_hash
        .unwrap_or_else(|| hex::encode(Sha256::digest(b"")));

    let parties = vec![
        AgreementParty {
            party_id: "payer".to_string(),
            display_name: params.payer_address.clone(),
            address: params.payer_address.clone(),
            role: Some("payer".to_string()),
        },
        AgreementParty {
            party_id: "payee".to_string(),
            display_name: params.payee_address.clone(),
            address: params.payee_address.clone(),
            role: Some("payee".to_string()),
        },
    ];

    let release_conditions = vec![AgreementReleaseCondition {
        mode: "htlc_preimage".to_string(),
        secret_hash_hex: Some(params.secret_hash_hex),
        release_authorizer: None,
        notes: None,
    }];

    let refund_conditions = vec![AgreementRefundCondition {
        refund_address: params.payer_address.clone(),
        timeout_height: params.timeout_height,
        notes: None,
    }];

    let obj = AgreementObject {
        agreement_id,
        version: AGREEMENT_OBJECT_VERSION,
        schema_id: Some(AGREEMENT_SCHEMA_ID_V1.to_string()),
        template_type,
        parties,
        payer: params.payer_address.clone(),
        payee: params.payee_address.clone(),
        mediator_reference: None,
        total_amount: params.total_amount_sats,
        network_marker: AGREEMENT_NETWORK_MARKER.to_string(),
        creation_time: now,
        deadlines: AgreementDeadlines {
            settlement_deadline: Some(params.timeout_height),
            refund_deadline: Some(params.timeout_height),
            dispute_window: None,
        },
        release_conditions,
        refund_conditions,
        milestones: Vec::new(),
        deposit_rule: None,
        proof_policy_reference: None,
        asset_reference: params.asset_reference,
        payment_reference: params.payment_reference,
        purpose_reference: None,
        release_summary: None,
        refund_summary: None,
        attestor_reference: None,
        resolver_reference: None,
        primary_resolver: None,
        primary_resolver_fee: None,
        fallback_resolver: None,
        fallback_resolver_fee: None,
        notes: None,
        document_hash,
        metadata_hash: None,
        invoice_reference: None,
        external_reference: None,
        disputed_metadata_only: false,
    };

    serde_json::to_string_pretty(&obj).map_err(|e| e.to_string())
}

fn parse_template_type(s: &str) -> Result<AgreementTemplateType, String> {
    match s {
        "simple-settlement" | "simple_release_refund" => Ok(AgreementTemplateType::SimpleReleaseRefund),
        "milestone" | "milestone_settlement" => Ok(AgreementTemplateType::MilestoneSettlement),
        "deposit" | "refundable_deposit" => Ok(AgreementTemplateType::RefundableDeposit),
        "otc" | "otc_settlement" => Ok(AgreementTemplateType::OtcSettlement),
        "merchant" | "merchant_delayed_settlement" => Ok(AgreementTemplateType::MerchantDelayedSettlement),
        "contractor" | "contractor_milestone" => Ok(AgreementTemplateType::ContractorMilestone),
        _ => Err(format!("unknown template_type: {s}")),
    }
}
