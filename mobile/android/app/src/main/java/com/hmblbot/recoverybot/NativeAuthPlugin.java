package com.hmblbot.recoverybot;

import android.os.CancellationSignal;

import androidx.core.content.ContextCompat;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

// "Continue with Google" with Android's own account picker (Credential Manager). The sign-in
// page passes the website's Google client ID and a nonce from the server; the picker returns
// an ID token for that client carrying the nonce, which the page posts to the server
// (Users::NativeSignInsController). Sign in with Apple uses Apple's web page on Android.
@CapacitorPlugin(name = "NativeAuth")
public class NativeAuthPlugin extends Plugin {
    @PluginMethod
    public void google(PluginCall call) {
        String clientId = call.getString("clientId", "");
        String nonce = call.getString("nonce", "");
        if (clientId == null || clientId.isEmpty() || nonce == null || nonce.isEmpty()) {
            call.reject("Google sign-in isn't set up");
            return;
        }
        GetSignInWithGoogleOption option = new GetSignInWithGoogleOption.Builder(clientId).setNonce(nonce).build();
        GetCredentialRequest request = new GetCredentialRequest.Builder().addCredentialOption(option).build();
        CredentialManager manager = CredentialManager.create(getContext());
        manager.getCredentialAsync(getActivity(), request, new CancellationSignal(), ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(GetCredentialResponse result) {
                    Credential credential = result.getCredential();
                    if (!(credential instanceof CustomCredential)
                        || !GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
                        call.reject("Google didn't send a sign-in");
                        return;
                    }
                    try {
                        GoogleIdTokenCredential google = GoogleIdTokenCredential.createFrom(credential.getData());
                        JSObject answer = new JSObject();
                        answer.put("idToken", google.getIdToken());
                        answer.put("givenName", google.getGivenName());
                        answer.put("familyName", google.getFamilyName());
                        call.resolve(answer);
                    } catch (Exception e) {
                        call.reject("Google's sign-in couldn't be read");
                    }
                }

                @Override
                public void onError(GetCredentialException e) {
                    if (e instanceof GetCredentialCancellationException) call.reject("Canceled");
                    else call.reject(e.getMessage() != null ? e.getMessage() : "Google sign-in didn't finish");
                }
            });
    }

    @PluginMethod
    public void apple(PluginCall call) {
        call.unavailable("Sign in with Apple uses Apple's web page on Android");
    }
}
