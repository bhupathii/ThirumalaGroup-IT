import re

with open('src/pages/finance/PaymentFollowUp.tsx', 'r') as f:
    content = f.read()

# Replace the timeline rendering in PaymentFollowUp.tsx
old_ui = """                        {modalFollowUpHistory.length === 0 ? (
                          <div className="text-slate-400 italic text-center py-6 text-[15px]">No callback logs recorded for this account.</div>
                        ) : (
                          modalFollowUpHistory.map((h: any) => (
                            <div key={h.id} className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-150 flex gap-3 items-start">
                              {/* Date column */}
                              <div className="shrink-0 text-right">
                                <div className="text-[14px] font-black font-mono text-slate-600">{h.follow_up_date.split('-').reverse().join('/')}</div>
                                <div className="text-[13px] font-bold text-slate-400 uppercase">{h.followed_up_by}</div>
                              </div>
                              {/* Badges */}
                              <div className="shrink-0 flex flex-col gap-1 pt-0.5">
                                <span className={`px-2 py-0.5 rounded text-[12px] font-black uppercase whitespace-nowrap ${
                                  h.result === 'PROMISED TO PAY' ? 'bg-blue-100 text-blue-700' :
                                  h.result === 'ANSWERED' ? 'bg-green-100 text-green-700' :
                                  h.result === 'CALL BACK' ? 'bg-amber-100 text-amber-700' :
                                  h.result === 'NO ANSWER' ? 'bg-red-100 text-red-700' :
                                  'bg-slate-100 text-slate-600'
                                }`}>{h.result}</span>
                                <span className="text-[12px] font-bold text-slate-400 uppercase">
                                  {h.contacted_person === 'CUSTOMER' ? 'Borrower' : h.contacted_person === 'GUARANTOR_1' ? 'G1' : h.contacted_person === 'GUARANTOR_2' ? 'G2' : 'Other'}
                                </span>
                                {h.next_follow_up_date && (
                                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">
                                    → {h.next_follow_up_date.split('-').reverse().join('/')}
                                  </span>
                                )}
                              </div>
                              {/* Narration */}
                              <p className="text-[15px] text-slate-700 font-semibold leading-snug flex-1">{h.narration}</p>
                            </div>
                          ))
                        )}"""

new_ui = """                        {modalFollowUpHistory.length === 0 ? (
                          <div className="text-slate-400 italic text-center py-6 text-[15px]">No callback logs recorded for this account.</div>
                        ) : (
                          <ul role="list" className="-mb-8 pl-1">
                            {modalFollowUpHistory.map((h: any, idx: number) => (
                              <li key={h.id}>
                                <div className="relative pb-8">
                                  {idx !== modalFollowUpHistory.length - 1 && (
                                    <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true"></span>
                                  )}
                                  <div className="relative flex space-x-3">
                                    <div>
                                      <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                                        h.result === 'PROMISED TO PAY' ? 'bg-green-500 text-white' :
                                        h.result === 'ANSWERED' ? 'bg-blue-500 text-white' :
                                        h.result === 'CALL BACK' ? 'bg-amber-500 text-white' :
                                        'bg-rose-500 text-white'
                                      }`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                      </span>
                                    </div>
                                    <div className="flex-1 min-w-0 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-black text-slate-800 uppercase">{h.result}</span>
                                          {h.next_follow_up_date && (
                                            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded uppercase border border-amber-200">
                                              Scheduled: {h.next_follow_up_date.split('-').reverse().join('/')}
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[10px] text-slate-500 font-bold font-mono text-right flex gap-2">
                                          <span>{h.follow_up_date.split('-').reverse().join('/')}</span>
                                          <span className="uppercase">{h.followed_up_by}</span>
                                        </div>
                                      </div>
                                      <p className="text-sm text-slate-700 font-medium whitespace-pre-wrap">{h.narration}</p>
                                      <div className="mt-2 flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Contacted:</span>
                                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded uppercase">
                                          {h.contacted_person === 'CUSTOMER' ? 'Borrower' : h.contacted_person === 'GUARANTOR_1' ? 'Guarantor 1' : h.contacted_person === 'GUARANTOR_2' ? 'Guarantor 2' : 'Other'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}"""

content = content.replace(old_ui, new_ui)

with open('src/pages/finance/PaymentFollowUp.tsx', 'w') as f:
    f.write(content)
