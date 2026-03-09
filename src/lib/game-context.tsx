"use client";

import {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  useSyncExternalStore,
} from "react";
import { scoreGame } from "./scoring";
import type { ExpeditionData, GameResult, RoundData } from "./types";

interface GameContextType {
  rounds: RoundData[];
  includePurple: boolean;
  setIncludePurple: (value: boolean) => void;
  addRound: (data: {
    result: GameResult;
    player1Expeditions: ExpeditionData[];
    player2Expeditions: ExpeditionData[];
    boardImage: string | null;
    inputMethod: "photo" | "manual";
  }) => RoundData;
  updateRound: (
    roundNumber: number,
    data: {
      result: GameResult;
      player1Expeditions: ExpeditionData[];
      player2Expeditions: ExpeditionData[];
    }
  ) => void;
  swapPlayersForRound: (roundNumber: number) => void;
  startNewGame: () => void;
  getRound: (roundNumber: number) => RoundData | undefined;
  totalScores: { player1: number; player2: number };
  overallWinner: string | null;
}

const GameContext = createContext<GameContextType | null>(null);

const STORAGE_KEY = "lostCitiesGame";

interface PersistedState {
  rounds: Omit<RoundData, "boardImage">[];
  includePurple: boolean;
}

function loadPersistedState(): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
}

function persistState(rounds: RoundData[], includePurple: boolean) {
  if (typeof window === "undefined") return;
  const toSave: PersistedState = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    rounds: rounds.map(({ boardImage, ...rest }) => rest),
    includePurple,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // localStorage full or unavailable
  }
}

/**
 * In-memory store for board images, keyed by round number.
 * Survives route navigation but not page refresh.
 */
const imageStore = new Map<number, string>();

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const isClient = useIsClient();

  const initialState = (() => {
    if (!isClient) return { rounds: [] as RoundData[], includePurple: false };
    const saved = loadPersistedState();
    if (saved) {
      return {
        rounds: saved.rounds.map((r) => ({
          ...r,
          boardImage: imageStore.get(r.roundNumber) ?? null,
        })),
        includePurple: saved.includePurple ?? false,
      };
    }
    return { rounds: [] as RoundData[], includePurple: false };
  })();

  const [rounds, setRounds] = useState<RoundData[]>(initialState.rounds);
  const [includePurple, setIncludePurpleState] = useState(
    initialState.includePurple
  );

  // Persist when state changes
  useEffect(() => {
    if (!isClient) return;
    persistState(rounds, includePurple);
  }, [rounds, includePurple, isClient]);

  const setIncludePurple = useCallback((value: boolean) => {
    setIncludePurpleState(value);
  }, []);

  const addRound = useCallback(
    (data: {
      result: GameResult;
      player1Expeditions: ExpeditionData[];
      player2Expeditions: ExpeditionData[];
      boardImage: string | null;
      inputMethod: "photo" | "manual";
    }): RoundData => {
      const roundNumber =
        rounds.length > 0
          ? Math.max(...rounds.map((r) => r.roundNumber)) + 1
          : 1;
      const newRound: RoundData = {
        roundNumber,
        result: data.result,
        player1Expeditions: data.player1Expeditions,
        player2Expeditions: data.player2Expeditions,
        boardImage: data.boardImage,
        inputMethod: data.inputMethod,
        timestamp: Date.now(),
        swapped: false,
      };

      if (data.boardImage) {
        imageStore.set(roundNumber, data.boardImage);
      }

      setRounds((prev) => [...prev, newRound]);
      return newRound;
    },
    [rounds]
  );

  const updateRound = useCallback(
    (
      roundNumber: number,
      data: {
        result: GameResult;
        player1Expeditions: ExpeditionData[];
        player2Expeditions: ExpeditionData[];
      }
    ) => {
      setRounds((prev) =>
        prev.map((r) =>
          r.roundNumber === roundNumber ? { ...r, ...data } : r
        )
      );
    },
    []
  );

  const swapPlayersForRound = useCallback((roundNumber: number) => {
    setRounds((prev) =>
      prev.map((round) => {
        if (round.roundNumber !== roundNumber) return round;

        const newP1 = round.player2Expeditions;
        const newP2 = round.player1Expeditions;

        const newResult = scoreGame(
          { name: "Player 1", expeditions: newP1 },
          { name: "Player 2", expeditions: newP2 }
        );

        return {
          ...round,
          player1Expeditions: newP1,
          player2Expeditions: newP2,
          result: newResult,
          swapped: !round.swapped,
        };
      })
    );
  }, []);

  const getRound = useCallback(
    (roundNumber: number) => {
      return rounds.find((r) => r.roundNumber === roundNumber);
    },
    [rounds]
  );

  const startNewGame = useCallback(() => {
    imageStore.clear();
    setRounds([]);
  }, []);

  const totalScores = rounds.reduce(
    (acc, r) => ({
      player1: acc.player1 + r.result.player1.totalScore,
      player2: acc.player2 + r.result.player2.totalScore,
    }),
    { player1: 0, player2: 0 }
  );

  const overallWinner =
    rounds.length === 0
      ? null
      : totalScores.player1 > totalScores.player2
        ? "Player 1"
        : totalScores.player2 > totalScores.player1
          ? "Player 2"
          : null;

  if (!isClient) {
    return null;
  }

  return (
    <GameContext.Provider
      value={{
        rounds,
        includePurple,
        setIncludePurple,
        addRound,
        updateRound,
        swapPlayersForRound,
        startNewGame,
        getRound,
        totalScores,
        overallWinner,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextType {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return ctx;
}
