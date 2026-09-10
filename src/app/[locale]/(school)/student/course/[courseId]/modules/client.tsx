'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileText,
  FileDown,
  Video,
  HelpCircle,
  ClipboardList,
  Clock,
  Calendar,
  Layers,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';

export function StudentCourseModulesClient({
  course,
  modules,
}: {
  course: any;
  modules: any[];
}) {
  return (
    <div className="space-y-8">
      {modules.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent className="space-y-3">
            <Layers className="h-12 w-12 mx-auto text-gray-300" />
            <h3 className="text-lg font-bold text-[#002446]">Belum Ada Modul Materi</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Guru belum mengunggah materi pembelajaran untuk course ini. Silakan periksa kembali nanti.
            </p>
          </CardContent>
        </Card>
      ) : (
        modules.map((mod, index) => (
          <Card key={mod.id} className="border border-gray-200 overflow-hidden shadow-sm bg-white">
            <CardHeader className="bg-gray-50/80 border-b py-3 px-5 flex flex-row items-center gap-3">
              <span className="flex items-center justify-center h-8 w-8 rounded-full bg-[#002446] text-white text-sm font-bold">
                {index + 1}
              </span>
              <div>
                <CardTitle className="text-lg font-bold text-[#002446]">
                  {mod.title}
                </CardTitle>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* 1. Konten Materi */}
              {mod.contents.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-blue-600" /> Materi Pembelajaran
                  </h4>

                  <div className="space-y-4">
                    {mod.contents.map((cnt: any) => (
                      <div
                        key={cnt.id}
                        className="p-4 rounded-lg border border-gray-100 bg-gray-50/50 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {cnt.type === 'TEXT' ? (
                              <FileText className="h-5 w-5 text-blue-600" />
                            ) : cnt.type === 'FILE' ? (
                              <FileDown className="h-5 w-5 text-emerald-600" />
                            ) : (
                              <Video className="h-5 w-5 text-red-600" />
                            )}
                            <h5 className="font-bold text-base text-[#002446]">
                              {cnt.title}
                            </h5>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {cnt.type}
                          </Badge>
                        </div>

                        {/* Rich Text Body */}
                        {cnt.type === 'TEXT' && cnt.body && (
                          <div
                            className="prose max-w-none text-sm text-gray-700 bg-white p-4 rounded-md border border-gray-100 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: cnt.body }}
                          />
                        )}

                        {/* File Download */}
                        {cnt.type === 'FILE' && cnt.fileUrl && (
                          <div className="flex items-center justify-between p-3 bg-white border rounded-md">
                            <div className="flex items-center gap-2">
                              <FileDown className="h-5 w-5 text-emerald-600" />
                              <span className="text-sm font-medium text-gray-800">
                                {cnt.fileName || 'Berkas Dokumen'}
                              </span>
                            </div>
                            <a
                              href={cnt.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              download
                              className="inline-flex items-center gap-1.5 text-xs font-medium bg-[#002446] text-white px-3 py-1.5 rounded hover:bg-[#002446]/90 transition-colors"
                            >
                              <FileDown className="h-3.5 w-3.5" /> Unduh Dokumen
                            </a>
                          </div>
                        )}

                        {/* Video */}
                        {cnt.type === 'VIDEO' && cnt.fileUrl && (
                          <div className="p-3 bg-white border rounded-md">
                            {cnt.fileUrl.includes('youtube.com') || cnt.fileUrl.includes('youtu.be') ? (
                              <div className="aspect-video w-full max-w-2xl rounded overflow-hidden">
                                <iframe
                                  src={cnt.fileUrl.replace('watch?v=', 'embed/')}
                                  title={cnt.title}
                                  className="w-full h-full"
                                  allowFullScreen
                                />
                              </div>
                            ) : (
                              <video
                                src={cnt.fileUrl}
                                controls
                                className="w-full max-w-2xl rounded"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Kuis */}
              {mod.quizzes.length > 0 && (
                <div className="space-y-3 pt-3 border-t">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <HelpCircle className="h-4 w-4 text-[#FF8928]" /> Kuis
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {mod.quizzes.map((quiz: any) => (
                      <Card
                        key={quiz.id}
                        className="border border-amber-200 bg-amber-50/30 hover:border-amber-300 transition-colors"
                      >
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-base font-bold text-[#002446]">
                            {quiz.title}
                          </CardTitle>
                          {quiz.description && (
                            <p className="text-xs text-gray-600 line-clamp-2">
                              {quiz.description}
                            </p>
                          )}
                        </CardHeader>
                        <CardContent className="p-4 pt-0 space-y-3">
                          <div className="flex items-center gap-4 text-xs text-gray-600 pt-2 border-t border-amber-100">
                            <span>{quiz._count.questions} Soal</span>
                            {quiz.duration && (
                              <span className="flex items-center gap-1 font-medium text-[#002446]">
                                <Clock className="h-3.5 w-3.5 text-[#FF8928]" />
                                {quiz.duration} Menit
                              </span>
                            )}
                            {quiz.deadline && (
                              <span className="flex items-center gap-1 text-gray-500">
                                <Calendar className="h-3.5 w-3.5" />
                                {new Date(quiz.deadline).toLocaleDateString('id-ID')}
                              </span>
                            )}
                          </div>

                          <Link
                            href={`/student/course/${course.id}/quiz/${quiz.id}`}
                            className="block"
                          >
                            <Button
                              size="sm"
                              className="w-full bg-[#FF8928] hover:bg-[#FF8928]/90 text-white flex items-center justify-center gap-1.5"
                            >
                              Mulai Kerjakan Kuis <ArrowRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Penugasan */}
              {mod.assignments.length > 0 && (
                <div className="space-y-3 pt-3 border-t">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <ClipboardList className="h-4 w-4 text-purple-600" /> Penugasan
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {mod.assignments.map((assign: any) => (
                      <Card
                        key={assign.id}
                        className="border border-purple-200 bg-purple-50/30 hover:border-purple-300 transition-colors"
                      >
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-base font-bold text-[#002446]">
                            {assign.title}
                          </CardTitle>
                          {assign.description && (
                            <p className="text-xs text-gray-600 line-clamp-2">
                              {assign.description}
                            </p>
                          )}
                        </CardHeader>
                        <CardContent className="p-4 pt-0 space-y-3">
                          <div className="flex items-center gap-4 text-xs text-gray-600 pt-2 border-t border-purple-100">
                            <span>Max Skor: {assign.maxScore}</span>
                            {assign.deadline && (
                              <span className="flex items-center gap-1 text-purple-700 font-medium">
                                <Calendar className="h-3.5 w-3.5" />
                                Deadline: {new Date(assign.deadline).toLocaleDateString('id-ID')}
                              </span>
                            )}
                          </div>

                          <Link
                            href={`/student/course/${course.id}/assignment/${assign.id}`}
                            className="block"
                          >
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full border-purple-400 text-purple-800 hover:bg-purple-600 hover:text-white flex items-center justify-center gap-1.5"
                            >
                              Kumpulkan Tugas <ArrowRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
