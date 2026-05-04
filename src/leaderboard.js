import { doc, setDoc, getDoc, increment } from 'firebase/firestore'
import { db } from './firebase.js'

export async function submitGameResults(dateStr, completedRounds) {
  const data = { totalGames: increment(1) }
  for (let i = 0; i < completedRounds.length; i++) {
    const answer = completedRounds[i].answer
    if (answer.length > 0) {
      data[`round${i}Solved`] = increment(1)
      data[`round${i}Answers`] = { [answer]: increment(1) }
    }
  }
  await setDoc(doc(db, 'daily', dateStr), data, { merge: true })
}

export async function fetchSolveRates(dateStr) {
  const snapshot = await getDoc(doc(db, 'daily', dateStr))
  if (!snapshot.exists()) return null
  const data = snapshot.data()
  const total = data.totalGames || 0
  if (total < 10) return null
  const rates = Array.from({ length: 10 }, (_, i) =>
    Math.round(((data[`round${i}Solved`] || 0) / total) * 100)
  )
  const answerCounts = Array.from({ length: 10 }, (_, i) => data[`round${i}Answers`] || {})
  return { rates, answerCounts }
}
