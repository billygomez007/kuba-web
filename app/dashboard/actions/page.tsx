"use client";

import { useEffect, useState } from "react";
import EmptyState from "../../components/EmptyState";


export default function ActionsPage(){

  const [actions,setActions] =
    useState<any[]>([]);


  useEffect(()=>{

    fetch("/api/actions/approval")
      .then(r=>r.json())
      .then(data=>{
        setActions(
          data.actions || []
        );
      });

  },[]);



  async function approveAction(id:string){

    await fetch("/api/actions/execute",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
      },
      body:JSON.stringify({
        actionId:id,
      }),
    });


    setActions(
      actions.filter(
        (action)=>
          action.id !== id
      )
    );

  }


  async function rejectAction(id:string){

    await fetch("/api/actions/approval",{
      method:"PATCH",
      headers:{
        "Content-Type":"application/json",
      },
      body:JSON.stringify({
        actionId:id,
        status:"rejected",
      }),
    });


    setActions(
      actions.filter(
        (action)=>
          action.id !== id
      )
    );

  }



  return (

    <div className="p-10">

      <h1 className="text-3xl font-black">
        Kuba Action Center
      </h1>

      <p className="mt-2 text-white/40">
        Review and approve AI actions.
      </p>


      <div className="mt-8 space-y-4">


        {actions.map((action)=>(

          <div
            key={action.id}
            className="rounded-2xl border border-white/10 bg-white/5 p-5"
          >

            <p className="font-bold">
              {action.channel}
            </p>


            <p className="mt-2">
              {action.message}
            </p>


            <p className="mt-2 text-sm text-white/40">
              To: {action.recipient}
            </p>


            <div className="mt-4 flex gap-3">

              <button
                onClick={()=>
                  approveAction(action.id)
                }
                className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-black"
              >
                Approve
              </button>


              <button
                onClick={()=>
                  rejectAction(action.id)
                }
                className="rounded-xl bg-red-500/20 px-4 py-2 text-sm font-bold text-red-300"
              >
                Reject
              </button>

            </div>

          </div>

        ))}


        {actions.length === 0 && (

          <EmptyState
            icon="✓"
            title="You’re in control of sensitive AI actions"
            description="When an AI employee needs permission to send a message or take an important action, it will appear here for your review."
            actionLabel="View AI Workforce"
            actionHref="/dashboard/workforce"
          />

        )}


      </div>

    </div>

  );

}
