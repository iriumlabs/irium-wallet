uniffi::include_scaffolding!("spv_mobile");

pub mod mobile;
pub mod ffi;

#[cfg(target_os = "android")]
pub mod android_jni;

// Re-export all public types and functions at crate root so UniFFI scaffolding
// can find them by their unqualified names.
pub use ffi::*;
