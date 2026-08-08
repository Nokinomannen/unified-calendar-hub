import * as React from 'react'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

export interface EventReminderProps {
  title?: string
  when?: string
  location?: string | null
  notes?: string | null
  calendarName?: string | null
  isLogReminder?: boolean
}

export function EventReminderEmail({
  title = 'Kommande event',
  when = '',
  location = null,
  notes = null,
  calendarName = null,
  isLogReminder = false,
}: EventReminderProps) {
  return (
    <Html lang="sv">
      <Head />
      <Preview>{`${title}${when ? ` — ${when}` : ''}`}</Preview>
      <Body style={{ backgroundColor: '#f6f5f2', fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif', margin: 0, padding: '32px 0' }}>
        <Container style={{ backgroundColor: '#ffffff', borderRadius: 12, maxWidth: 520, padding: 28 }}>
          <Text style={{ color: '#8a8578', fontSize: 12, letterSpacing: 1.2, margin: 0, textTransform: 'uppercase' }}>
            {isLogReminder ? 'Dags att logga timmar' : 'Påminnelse'}
          </Text>
          <Heading style={{ color: '#1c1b18', fontSize: 24, lineHeight: '32px', margin: '8px 0 4px' }}>{title}</Heading>
          {when ? <Text style={{ color: '#4a4740', fontSize: 15, margin: '0 0 4px' }}>{when}</Text> : null}
          {location ? <Text style={{ color: '#8a8578', fontSize: 14, margin: 0 }}>{location}</Text> : null}
          {calendarName ? (
            <Text style={{ color: '#8a8578', fontSize: 13, margin: '10px 0 0' }}>Kalender: {calendarName}</Text>
          ) : null}
          {notes ? (
            <Section>
              <Hr style={{ borderColor: '#eceae4', margin: '20px 0' }} />
              <Text style={{ color: '#4a4740', fontSize: 14, margin: 0, whiteSpace: 'pre-line' }}>{notes}</Text>
            </Section>
          ) : null}
          <Hr style={{ borderColor: '#eceae4', margin: '24px 0 16px' }} />
          <Text style={{ color: '#a19c90', fontSize: 12, margin: 0 }}>
            {isLogReminder
              ? 'Öppna kalendern och registrera dina faktiska timmar.'
              : 'Skickat automatiskt från din kalender.'}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: EventReminderEmail,
  displayName: 'Event reminder',
  subject: (data: Record<string, any>) =>
    data['isLogReminder']
      ? `Logga timmar: ${data['title'] ?? 'ditt pass'}`
      : `Påminnelse: ${data['title'] ?? 'kommande event'}${data['when'] ? ` — ${data['when']}` : ''}`,
  previewData: {
    title: 'DJ · Plan B',
    when: 'lördag 15 augusti, 22:00',
    location: 'Plan B, Malmö',
    notes: 'Ta med USB-stickorna.',
    calendarName: 'DJ',
  },
} satisfies TemplateEntry
