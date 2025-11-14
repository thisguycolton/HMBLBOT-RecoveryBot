import React, { useState, useEffect, useRef } from "react";
import LavaOverlay from "./LavaOverlay";
import axios from "axios";
import { Copy, Hash, Shuffle, History, UserCheck, Settings } from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";


import { useMemo } from "react";



function formatTime(seconds) {
  const min = Math.floor(seconds / 60).toString().padStart(2, "0");
  const sec = (seconds % 60).toString().padStart(2, "0");
  return `${min}:${sec}`;
}

function TopicificatorApp() {
  const [topicSets, setTopicSets] = useState([]);
  const [selectedTopicSetId, setSelectedTopicSetId] = useState(null);
  const [topic, setTopic] = useState(null);
  const [timer, setTimer] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [timerDuration, setTimerDuration] = useState(180); // seconds
  const [durationInput, setDurationInput] = useState(3); // default 3 minutes
  const [mode, setMode] = useState(null);
  const [coveredTopics, setCoveredTopics] = useState([]);
  const [showPreviousModal, setShowPreviousModal] = useState(false);
  const [showNumberModal, setShowNumberModal] = useState(false);
  const [numberInput, setNumberInput] = useState("");
  const [hasStarted, setHasStarted] = useState(false);
  const numberInputRef = useRef(null);
  const selectedTopicSet = useMemo(
  () => topicSets.find((set) => set.id === selectedTopicSetId),
  [topicSets, selectedTopicSetId]
);
  const handleCopyTopics = () => {
    if (!coveredTopics.length) return;
  
    const allButLast = coveredTopics.slice(0, -1)
      .map((t) => `• ${t.title}`)
      .join("<br>");
  
    const last = coveredTopics.at(-1);
    const lastFormatted = last
      ? `• <strong>${last.title}</strong>`
      : "";
  
    const contentHTML = [allButLast, lastFormatted].filter(Boolean).join("<br>");
    const contentText = contentHTML.replace(/<\/?[^>]+(>|$)/g, ""); // fallback plain text
  
    navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([contentHTML], { type: "text/html" }),
        "text/plain": new Blob([contentText], { type: "text/plain" }),
      }),
    ]).then(() => {
    }).catch((err) => {
    });
  };

  useEffect(() => {
    if (timer === 0 || timer === null) return;
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const startTimer = (mode) => {
    setMode(mode);
    setTimer(timerDuration);
  };

useEffect(() => {
  axios
    .get(`${window.location.origin}/api/topic_sets`)
    .then((res) => {
      setTopicSets(res.data);
      if (res.data.length > 0) {
        setSelectedTopicSetId(res.data[0].id); // default to first
      }
    })
    .catch((err) => {
      console.error("Failed to load topic sets", err);
    });
}, []);

useEffect(() => {
  if (showNumberModal && numberInputRef.current) {
    numberInputRef.current.focus();
    numberInputRef.current.select();
  }
}, [showNumberModal]);

const getRandomTopic = async () => {
  try {
    const res = await axios.get(`${window.location.origin}/api/topics/random`, {
      params: {
        topic_set_id: selectedTopicSetId,
      },
    });
    setTopic(res.data);
    startTimer("random");
    setCoveredTopics((prev) => [...prev, res.data]);
    setHasStarted(true);
  } catch (error) {
    alert("Failed to fetch topic");
  }
};

  const openNumberModal = () => {
    setNumberInput("");
    setShowNumberModal(true);
  };
  
const fetchTopicByNumber = async () => {
  if (!numberInput) return;

  try {
    const res = await axios.get(`${window.location.origin}/api/topics/by_number`, {
      params: {
        number: numberInput,
        topic_set_id: selectedTopicSetId,
      },
    });
    setTopic(res.data);
    setCoveredTopics((prev) => [...prev, res.data]);
    startTimer("number");
    setShowNumberModal(false);
    setHasStarted(true);
  } catch (err) {
    alert("Topic not found in this set.");
  }
};

  const getPreviousTopic = () => {
    if (coveredTopics.length === 0) return;
    setShowPreviousModal(true);
  };

  const choosePreviousTopic = (topic) => {
    setTopic(topic);
    setShowPreviousModal(false);
    startTimer("previous");
    setHasStarted(true);
  };

  const freeShare = () => {
    setTopic({ title: "Free Share / Check-In", subtitle: "What is happening in your sobriety?" });
    startTimer("free");
  };
  return (
<div className="  bg-gray-900 text-white relative">
  <AnimatePresence>
    {hasStarted && (
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ duration: 1 }}
        className="absolute left-1/2 transform -translate-x-1/2 text-gray-200 text-4xl md:text-5xl ttSans font-bold z-30 w-full text-center top-5 mt-5"
      >
        THE TOPICIFICATOR <span className="!text-cyan-500">9002</span>
      </motion.div>
    )}
  </AnimatePresence>
  <div className="fixed bottom-0 left-0 bg-transparent p-2 z-20">
    <div className="flex flex-wrap gap-2 justify-center mt-4 md:bg-cyan-950/50 rounded-lg p-4 md:shadow-lg">
      <button
        onClick={() => setShowSettingsModal(true)}
        className="!bg-cyan-950 py-2 px-2 px-lg-4 py-lg-2 rounded"
      >
        <Settings className="w-5 h-5" />
      </button>
    </div>
  </div>
  <div className="fixed bottom-0 w-full bg-transparent p-2 flex justify-center gap-4 z-5">
  <div className="flex flex-wrap gap-2 justify-center mt-4 bg-cyan-950/50 rounded-lg p-4 shadow-lg">

    {/* Random Topic */}
    <div className="relative group">
      <button
        type="button"
        onClick={getRandomTopic}
        className="!bg-blue-600 px-4 py-2 rounded"
      >
        <Shuffle className="w-5 h-5" />
      </button>
      <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition z-50">
        Random Topic
      </span>
    </div>

    {/* Pick a Number */}
    <div className="relative group">
      <button
        type="button"
        onClick={openNumberModal}
        className="!bg-green-600 px-4 py-2 rounded"
      >
        <Hash className="w-5 h-5" />
      </button>
      <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition z-50">
        Pick a Number
      </span>
    </div>

    {/* Previous Topic */}
    <div className="relative group">
      <button
        type="button"
        onClick={getPreviousTopic}
        className="!bg-yellow-600 px-4 py-2 rounded"
      >
        <History className="w-5 h-5" />
      </button>
      <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition z-50">
        Previous Topic
      </span>
    </div>

    {/* Free Share */}
    <div className="relative group">
      <button
        type="button"
        onClick={freeShare}
        className="!bg-purple-600 px-4 py-2 rounded"
      >
        <UserCheck className="w-5 h-5" />
      </button>
      <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition z-50">
        Free Share / Check-In
      </span>
    </div>

  </div>
</div>
    <div className="bg-gray-900 text-white w-screen h-screen flex items-center justify-center">

      
      <div className="relative w-full h-full md:h-auto md:aspect-video md:max-w-5xl bg-gray-800 rounded-lg overflow-hidden flex flex-col items-center justify-between py-8 px-6 mx-auto shadow-lg">
        {/* Timer */}
        <LavaOverlay progress={(timerDuration - timer) / timerDuration} />
        
        {timer !== null && mode !== "free" && (
          <button
            onClick={() => startTimer(mode)}
            title="Restart Timer"
            className="!text-2xl fw-bold !rounded-none !rounded-bl-lg !rounded-tr-lg shadow-md absolute top-0 end-0 w-30 text-center ttSans !bg-cyan-950/70 !p-3 hover:bg-cyan-950/90 transition"
          >
            {formatTime(timer)}
          </button>
        )}
        <div className="text-2xl fw-bold rounded-br-lg shadow-md absolute top-0 start-0 w-20 text-center ttSans bg-cyan-950/70 p-0">
          <button
            onClick={handleCopyTopics}
            className="!bg-transparent text-white px-4 py-3 !rounded-none !rounded-br-lg !rounded-tl-lg hover:text-gray-200 transition-colors duration-300"
          >
            <Copy className="w-5 h-5" />
          </button>
        </div>

        {/* Topic Display */}
        <div className="text-center px-4 mt-8 flex-grow flex flex-col justify-center z-3">
          {topic ? (
            <>
              <h1 className="text-4xl font-bold mb-4 ttSans">{topic.title}</h1>
              <p className="text-2xl text-gray-200 ftSans">{topic.subtitle}</p>
            </>
          ) : (
            <>
              <div className="font-bold mb-4 ttSans text-4xl md:text-5xl">THE TOPICIFICATOR <span className="!text-cyan-500">9002</span></div>
              <p className="text-2xl text-center! ftSans">Press a button to get started</p>
            </>
          )}
        </div>

        {/* Large Timer for Free Mode */}
        {mode === "free" && (
          <div className="absolute flex items-center top-35">
            <span className="text-6xl font-bold ttSans">{formatTime(timer)}</span>
          </div>
        )}


        </div>
        <img src="https://humblebot.s3.us-west-2.amazonaws.com/hmblbotLOGOsmBLUE.png" alt="HumbleBot Logo" className="hidden md:block fixed bottom-7 right-0 transform -translate-x-1/2 w-15 opacity-65 hover:opacity-95" />

        {showPreviousModal && (
          <div className="fixed top-0 left-0 w-full h-full bg-[rgba(0,0,0,0.8)] items-center flex justify-center z-40">
            <div className="bg-slate-900 text-light rounded-lg p-6 max-w-lg max-h-[80vh] overflow-y-auto shadow-xl border-2 border-slate-700">
              <h2 className="!text-1xl font-bold mb-4 ttSans">Previously Shared Topics</h2>
              <div className="grid gap-4 mb-4">
                {[...coveredTopics].reverse().map((t, index) => (
                  <button
                    key={index}
                    className="w-full text-left py-2 px-2 rounded bg-white/10 hover:bg-white/20 "
                    onClick={() => choosePreviousTopic(t)}
                  >
                    <p className="font-semibold ftSans m-0">{t.title}</p>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowPreviousModal(false)}
                className="mt-6 !bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
{showNumberModal && (
  <div className="fixed top-0 left-0 w-full h-full bg-[rgba(0,0,0,0.8)] flex items-center justify-center z-40">
    <div className="bg-slate-900 text-white rounded-lg p-6 max-w-sm w-full shadow-xl border-2 border-slate-700">
      <h2 className="text-2xl font-bold mb-2">Enter Topic Number</h2>

      {/* New helper text showing min/max */}
      <p className="text-md text-gray-400 mb-4 ftSans">
        Enter a number between{" "}
        <span className="font-semibold">1</span> and{" "}
        <span className="font-semibold">
          {selectedTopicSet?.topics_count ?? "…"}
        </span>
        .
      </p>

      <input
        type="number"
        value={numberInput}
        ref={numberInputRef}
        onChange={(e) => setNumberInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            fetchTopicByNumber();
          }
        }}
        min={1}
        max={selectedTopicSet?.topics_count || undefined}
        className="w-full p-3 mb-4 rounded border-slate-700 text-white border-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
        placeholder="e.g. 42"
      />

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setShowNumberModal(false)}
          className="bg-gray-700 px-4 py-2 rounded hover:bg-gray-600"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={fetchTopicByNumber}
          className="!bg-green-600 px-4 py-2 rounded hover:bg-green-500"
        >
          Go
        </button>
      </div>
    </div>
  </div>
)}
        {showSettingsModal && (
      <div className="fixed top-0 left-0 w-full h-full bg-[rgba(0,0,0,0.8)] flex items-center justify-center z-50">
        <div className="bg-slate-900 text-white rounded-lg p-6 w-full max-w-sm shadow-xl border-2 border-slate-700">
          <h2 className="text-2xl font-bold mb-4">Settings</h2>

          <label htmlFor="duration" className="block mb-2 text-sm">
            Timer Duration (in minutes)
          </label>
          <input
            id="duration"
            type="number"
            min="1"
            value={durationInput}
            onChange={(e) => setDurationInput(e.target.value)}
            className="w-full p-3 mb-4 rounded border-slate-700 text-white border-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
          <label htmlFor="topicSet" className="block mb-2 text-sm">
            Topic Set
          </label>
          <select
            id="topicSet"
            value={selectedTopicSetId || ""}
            onChange={(e) => setSelectedTopicSetId(Number(e.target.value))}
            className="w-full p-3 mb-4 rounded border-slate-700 text-white border-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            {topicSets.map((set) => (
              <option key={set.id} value={set.id}>
                {set.name}
              </option>
            ))}
          </select>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowSettingsModal(false)}
              className="bg-gray-700 px-4 py-2 rounded hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const minutes = parseInt(durationInput);
                if (!isNaN(minutes) && minutes > 0) {
                  setTimerDuration(minutes * 60);
                  setShowSettingsModal(false);
                }
              }}
              className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-500"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
  </div>
  );
}


export default TopicificatorApp;