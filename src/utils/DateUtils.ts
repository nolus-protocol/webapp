export class DateUtils {
  static months = [
    'Jan.',
    'Feb.',
    'Mar.',
    'Apr.',
    'May',
    'Jun.',
    'Jul.',
    'Aug.',
    'Sep.',
    'Oct.',
    'Nov.',
    'Dec.'
  ]

  static sec = 1000
  static min = 60 * this.sec
  static hour = this.min * 60
  static day = this.hour * 24
  static days = 30 * this.day

  static one_s = 'a second'
  static many_s = 'seconds'

  static one_m = 'a minute'
  static many_m = 'minutes'

  static one_h = 'an hour'
  static many_h = 'hours'

  static one_d = 'a day'
  static many_d = 'days'

  public static parseDateTime(dateTime: string | null): string {

    if (dateTime === null) {
      return ''
    }

    const time = new Date(dateTime)
    const currentDate = new Date()
    const diff = time.getTime() - currentDate.getTime()

    if (diff < 0) {
      return this.one_s
    }

    if (diff < this.min) {
      const time = Math.floor(diff / this.sec)
      if (time <= 1) {
        return this.one_s
      }
      return `${time} ${this.many_s}`
    }

    if (diff < this.hour) {
      const time = Math.floor(diff / this.min)
      if (time <= 1) {
        return this.one_m
      }
      return `${time} ${this.many_m}`
    }

    if (diff < this.day) {
      const time = Math.floor(diff / this.hour)
      if (time <= 1) {
        return this.one_h
      }
      return `${time} ${this.many_h}`
    }

    if (diff < this.days) {
      const time = Math.floor(diff / this.day)
      if (time <= 1) {
        return this.one_d
      }
      return `${time} ${this.many_d}`
    }

    const m = this.months[time.getMonth()]
    const date = `${time.getDate()}`
    const year = time.getFullYear()

    return `${m} ${date}, ${year}`
  }

  public static formatDateTime(dateTime: string | null) {
    if (dateTime === null) {
      return false
    }

    const time = new Date(dateTime)

    const m = this.months[time.getMonth()]
    const date = `${time.getDate()}`
    const year = time.getFullYear()
    const timeString = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    return `${m} ${date}, ${year} ${timeString}`
  }
}
