"use client";

import { useState } from "react";


export default function EmailIntegrationPage() {

  const [email,setEmail] =
    useState("");

  const [message,setMessage] =
    useState("");


  async function connectEmail(){

    const response =
      await fetch(
        "/api/integrations/email",
        {
          method:"POST",
          headers:{
            "Content-Type":"application/json",
          },
          body:JSON.stringify({
            email,
          }),
        },
      );


    const data =
      await response.json();


    if(data.success){

      setMessage(
        "Email connected successfully."
      );

    }
    else{

      setMessage(
        data.error || "Connection failed."
      );

    }

  }


  return (
    <main className="min-h-screen bg-[#050507] px-6 py-10 text-white">

      <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/[0.04] p-8">

        <h1 className="text-3xl font-black">
          Email Integration
        </h1>

        <p className="mt-3 text-white/50">
          Connect your business email so Kuba can handle customer communication.
        </p>


        <div className="mt-8 space-y-4">

          <input
            value={email}
            onChange={(e)=>
              setEmail(e.target.value)
            }
            placeholder="Business email address"
            className="w-full rounded-xl bg-black/30 p-4"
          />


          <button
            onClick={connectEmail}
            className="rounded-xl bg-white px-8 py-4 font-bold text-black"
          >
            Connect Email
          </button>


          {message && (

            <p className="text-sm text-cyan-300">
              {message}
            </p>

          )}

        </div>

      </div>

    </main>
  );
}
