import { describe, expect, it } from 'vitest'
import {
  type BestTimes,
  bestTimeFor,
  finishBannerLines,
  formatTime,
  readBestTimes,
  recordTime,
} from './timer'

describe('formatTime', () => {
  it('starts at zero', () => {
    expect(formatTime(0)).toBe('0:00.0')
  })

  it('shows tenths before the first second is up', () => {
    expect(formatTime(400)).toBe('0:00.4')
    expect(formatTime(7400)).toBe('0:07.4')
  })

  it('never rounds up, so the clock only ever shows time you have really used', () => {
    expect(formatTime(99)).toBe('0:00.0')
    expect(formatTime(999)).toBe('0:00.9')
  })

  it('rolls over at exactly a minute', () => {
    expect(formatTime(60_000)).toBe('1:00.0')
  })

  it('keeps counting past a minute', () => {
    expect(formatTime(61_250)).toBe('1:01.2')
  })

  it('keeps counting past ten minutes', () => {
    expect(formatTime(600_000)).toBe('10:00.0')
    expect(formatTime(729_900)).toBe('12:09.9')
  })

  it('stops at 99:59.9 so a game left running all day cannot stretch the HUD', () => {
    expect(formatTime(5_999_900)).toBe('99:59.9')
    expect(formatTime(999_999_999_999)).toBe('99:59.9')
  })

  it('shows a clean zero for nonsense instead of NaN', () => {
    expect(formatTime(Number.NaN)).toBe('0:00.0')
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe('0:00.0')
    expect(formatTime(-5)).toBe('0:00.0')
  })
})

describe('readBestTimes', () => {
  it('is empty when nothing has ever been saved', () => {
    expect(readBestTimes(null)).toEqual({})
    expect(readBestTimes('')).toEqual({})
  })

  it('reads back what was saved', () => {
    expect(readBestTimes('{"First Steps":12300,"The Tall Tower":45600}')).toEqual({
      'First Steps': 12300,
      'The Tall Tower': 45600,
    })
  })

  it('shrugs off scribbled-over data instead of crashing', () => {
    expect(readBestTimes('hello i am not json')).toEqual({})
    expect(readBestTimes('{"First Steps":')).toEqual({})
  })

  it('ignores saved data of the wrong shape', () => {
    expect(readBestTimes('[1,2,3]')).toEqual({})
    expect(readBestTimes('"a string"')).toEqual({})
    expect(readBestTimes('42')).toEqual({})
    expect(readBestTimes('null')).toEqual({})
    expect(readBestTimes('true')).toEqual({})
  })

  it('keeps the good times and drops the impossible ones', () => {
    expect(
      readBestTimes('{"broken":"fast","negative":-5,"zero":0,"nested":{"x":1},"good":12300}'),
    ).toEqual({ good: 12300 })
  })

  it('drops a time that is not a real number', () => {
    expect(readBestTimes('{"huge":1e999}')).toEqual({})
  })
})

describe('bestTimeFor', () => {
  it('is nothing at all for a level that has never been finished', () => {
    expect(bestTimeFor({}, 'First Steps')).toBe(null)
  })

  it('is the remembered time for a level that has', () => {
    expect(bestTimeFor({ 'First Steps': 12300 }, 'First Steps')).toBe(12300)
  })
})

describe('recordTime', () => {
  it('makes the very first run the best run', () => {
    const result = recordTime({}, 'First Steps', 24_600)
    expect(result.isNewBest).toBe(true)
    expect(result.best).toBe(24_600)
    expect(result.times).toEqual({ 'First Steps': 24_600 })
  })

  it('remembers a faster run', () => {
    const result = recordTime({ 'First Steps': 24_600 }, 'First Steps', 20_100)
    expect(result.isNewBest).toBe(true)
    expect(result.best).toBe(20_100)
    expect(result.times).toEqual({ 'First Steps': 20_100 })
  })

  it('keeps the old record after a slower run', () => {
    const result = recordTime({ 'First Steps': 20_100 }, 'First Steps', 31_000)
    expect(result.isNewBest).toBe(false)
    expect(result.best).toBe(20_100)
    expect(result.times).toEqual({ 'First Steps': 20_100 })
  })

  it('does not count a tie: you have to beat the record, not match it', () => {
    const result = recordTime({ 'First Steps': 20_100 }, 'First Steps', 20_100)
    expect(result.isNewBest).toBe(false)
    expect(result.best).toBe(20_100)
    expect(result.times).toEqual({ 'First Steps': 20_100 })
  })

  it('leaves the other levels alone', () => {
    const result = recordTime({ 'The Tall Tower': 45_600 }, 'First Steps', 24_600)
    expect(result.times).toEqual({ 'The Tall Tower': 45_600, 'First Steps': 24_600 })
  })

  it('never changes the times it was handed', () => {
    const before: BestTimes = { 'First Steps': 24_600 }
    recordTime(before, 'First Steps', 10_000)
    expect(before).toEqual({ 'First Steps': 24_600 })
  })
})

describe('finishBannerLines', () => {
  it('shouts about a new record', () => {
    expect(finishBannerLines(24_600, { times: {}, best: 24_600, isNewBest: true })).toEqual([
      'TIME 0:24.6',
      'NEW BEST TIME!',
    ])
  })

  it('shows the time to beat when the record stands', () => {
    expect(finishBannerLines(31_000, { times: {}, best: 20_100, isNewBest: false })).toEqual([
      'TIME 0:31.0',
      'BEST 0:20.1',
    ])
  })
})
